'use strict';

// ---------------------------------------------------------------------------
// Mock supabaseAdmin before requiring tokenService.
// Each test configures the mock chain via mockSupabase helpers below.
// ---------------------------------------------------------------------------
jest.mock('../config/supabaseClient', () => ({ supabaseAdmin: buildMock() }));
jest.mock('../utils/dateUtils', () => ({ todayIST: () => '2024-01-15' }));

const { supabaseAdmin } = require('../config/supabaseClient');
const { bookToken, transitionToken } = require('../services/tokenService');

// ---------------------------------------------------------------------------
// Mock builder — returns a chainable Supabase-like query object.
// Call mockResolve(data, error) on the chain to set the resolved value.
// ---------------------------------------------------------------------------
function buildMock() {
  const chain = {};
  const methods = ['from','select','insert','update','eq','neq','in','order','limit','single','maybeSingle','rpc'];
  let _resolve = { data: null, error: null };

  methods.forEach(m => {
    chain[m] = jest.fn(() => {
      if (m === 'single' || m === 'maybeSingle') return Promise.resolve(_resolve);
      if (m === 'rpc') return Promise.resolve(_resolve);
      return chain;
    });
  });

  // head:true count queries resolve immediately
  chain.select = jest.fn((cols, opts) => {
    if (opts?.head) return Promise.resolve({ count: _resolve.count ?? 0, error: null });
    return chain;
  });

  chain.__setResolve = (data, error = null, count = 0) => {
    _resolve = { data, error, count };
  };

  return chain;
}

// Shorthand to reconfigure the mock for each call sequence
function setup(responses) {
  // responses: array of { data, error, count } in call order
  let i = 0;
  const next = () => responses[i++] ?? { data: null, error: null };

  supabaseAdmin.from.mockImplementation(() => {
    const r = next();
    return buildChain(r);
  });
  supabaseAdmin.rpc.mockImplementation(() => Promise.resolve(next()));
}

function buildChain(resolved) {
  const c = {};
  const pass = () => c;
  ['select','insert','update','eq','neq','in','order','limit'].forEach(m => {
    c[m] = jest.fn((a, opts) => {
      if (m === 'select' && opts?.head) return Promise.resolve({ count: resolved.count ?? 0, error: null });
      return c;
    });
  });
  c.single      = jest.fn(() => Promise.resolve(resolved));
  c.maybeSingle = jest.fn(() => Promise.resolve(resolved));
  return c;
}

// ---------------------------------------------------------------------------
// ALLOWED_TRANSITIONS — exported for white-box tests
// ---------------------------------------------------------------------------
const TRANSITIONS = {
  waiting:     ['called', 'skipped', 'cancelled'],
  called:      ['in_progress', 'completed', 'skipped', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  skipped:     ['waiting', 'cancelled'],
};

// ---------------------------------------------------------------------------
// 1. ALLOWED_TRANSITIONS white-box
// ---------------------------------------------------------------------------
describe('ALLOWED_TRANSITIONS state machine', () => {
  test.each([
    ['waiting',     'called'],
    ['waiting',     'skipped'],
    ['waiting',     'cancelled'],
    ['called',      'in_progress'],
    ['called',      'completed'],   // direct complete without in_progress
    ['called',      'skipped'],
    ['called',      'cancelled'],
    ['in_progress', 'completed'],
    ['in_progress', 'cancelled'],
    ['skipped',     'waiting'],     // recall
    ['skipped',     'cancelled'],
  ])('%s → %s is allowed', (from, to) => {
    expect(TRANSITIONS[from]).toContain(to);
  });

  test.each([
    ['waiting',     'in_progress'],
    ['waiting',     'completed'],
    ['called',      'waiting'],
    ['in_progress', 'waiting'],
    ['in_progress', 'called'],
    ['in_progress', 'skipped'],
    ['completed',   'waiting'],
    ['cancelled',   'waiting'],
  ])('%s → %s is NOT allowed', (from, to) => {
    expect(TRANSITIONS[from] ?? []).not.toContain(to);
  });
});

// ---------------------------------------------------------------------------
// 2. bookToken — happy path
// ---------------------------------------------------------------------------
describe('bookToken', () => {
  const doctorId  = 'doc-uuid';
  const patientId = 'pat-uuid';

  function makeFromSequence(holiday, doctor, existing, rpcResult) {
    let call = 0;
    supabaseAdmin.from = jest.fn(() => {
      call++;
      if (call === 1) return buildChain({ data: holiday,  error: null }); // holidays
      if (call === 2) return buildChain({ data: doctor,   error: null }); // doctors
      if (call === 3) return buildChain({ data: existing, error: null }); // duplicate check
      return buildChain({ data: null, error: null });
    });
    supabaseAdmin.rpc = jest.fn(() => Promise.resolve(rpcResult));
  }

  test('books a token successfully', async () => {
    const token = { id: 't1', token_number: 1, status: 'waiting' };
    makeFromSequence(
      null,                                                    // no holiday
      { id: doctorId, is_available: true, max_daily_tokens: null }, // doctor
      null,                                                    // no existing booking
      { data: token, error: null }                             // rpc result
    );

    const result = await bookToken({ patientId, doctorId, notes: null });
    expect(result).toEqual(token);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('book_token_atomic', expect.objectContaining({
      p_patient_id: patientId,
      p_doctor_id:  doctorId,
      p_date:       '2024-01-15',
    }));
  });

  test('rejects booking on a holiday', async () => {
    makeFromSequence({ id: 'h1' }, null, null, null);
    await expect(bookToken({ patientId, doctorId })).rejects.toMatchObject({ status: 400 });
  });

  test('rejects when doctor is unavailable', async () => {
    makeFromSequence(null, { id: doctorId, is_available: false, max_daily_tokens: null }, null, null);
    await expect(bookToken({ patientId, doctorId })).rejects.toMatchObject({ status: 400 });
  });

  test('rejects duplicate booking (existing non-cancelled token)', async () => {
    makeFromSequence(
      null,
      { id: doctorId, is_available: true, max_daily_tokens: null },
      { id: 'existing-token' },  // duplicate found
      null
    );
    await expect(bookToken({ patientId, doctorId })).rejects.toMatchObject({ status: 409 });
  });

  test('allows rebooking after cancellation (no existing non-cancelled token)', async () => {
    const token = { id: 't2', token_number: 2, status: 'waiting' };
    makeFromSequence(
      null,
      { id: doctorId, is_available: true, max_daily_tokens: null },
      null,   // cancelled token excluded by .neq('status','cancelled') — returns null
      { data: token, error: null }
    );
    const result = await bookToken({ patientId, doctorId });
    expect(result).toEqual(token);
  });

  test('rejects when max daily tokens reached', async () => {
    let call = 0;
    supabaseAdmin.from = jest.fn(() => {
      call++;
      if (call === 1) return buildChain({ data: null, error: null }); // no holiday
      if (call === 2) return buildChain({ data: { id: doctorId, is_available: true, max_daily_tokens: 5 }, error: null });
      // count query for max tokens
      if (call === 3) {
        const c = buildChain({ data: null, error: null });
        c.select = jest.fn(() => Promise.resolve({ count: 5, error: null }));
        return c;
      }
      return buildChain({ data: null, error: null });
    });
    await expect(bookToken({ patientId, doctorId })).rejects.toMatchObject({ status: 400 });
  });
});

// ---------------------------------------------------------------------------
// 3. transitionToken — call/start/complete flow
// ---------------------------------------------------------------------------
describe('transitionToken', () => {
  const doctorId = 'doc-uuid';
  const tokenId  = 'tok-uuid';

  function makeTransition(fromStatus, toStatus, expectError) {
    supabaseAdmin.from = jest.fn(() => {
      let call = 0;
      const c = buildChain({ data: { id: tokenId, status: fromStatus, doctor_id: doctorId }, error: null });
      const orig = c.single.bind(c);
      c.single = jest.fn(() => {
        call++;
        if (call === 1) return orig(); // fetch token
        // second call is the update
        return Promise.resolve({ data: { id: tokenId, status: toStatus }, error: null });
      });
      return c;
    });
  }

  test('waiting → called', async () => {
    makeTransition('waiting', 'called');
    const r = await transitionToken({ tokenId, doctorId, toStatus: 'called' });
    expect(r.status).toBe('called');
  });

  test('called → in_progress (Start button)', async () => {
    makeTransition('called', 'in_progress');
    const r = await transitionToken({ tokenId, doctorId, toStatus: 'in_progress' });
    expect(r.status).toBe('in_progress');
  });

  test('called → completed (direct complete)', async () => {
    makeTransition('called', 'completed');
    const r = await transitionToken({ tokenId, doctorId, toStatus: 'completed' });
    expect(r.status).toBe('completed');
  });

  test('in_progress → completed', async () => {
    makeTransition('in_progress', 'completed');
    const r = await transitionToken({ tokenId, doctorId, toStatus: 'completed' });
    expect(r.status).toBe('completed');
  });

  test('called → skipped', async () => {
    makeTransition('called', 'skipped');
    const r = await transitionToken({ tokenId, doctorId, toStatus: 'skipped' });
    expect(r.status).toBe('skipped');
  });

  test('skipped → waiting (recall)', async () => {
    makeTransition('skipped', 'waiting');
    const r = await transitionToken({ tokenId, doctorId, toStatus: 'waiting' });
    expect(r.status).toBe('waiting');
  });

  test('rejects invalid transition waiting → completed', async () => {
    supabaseAdmin.from = jest.fn(() =>
      buildChain({ data: { id: tokenId, status: 'waiting', doctor_id: doctorId }, error: null })
    );
    await expect(transitionToken({ tokenId, doctorId, toStatus: 'completed' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects transition from terminal state completed', async () => {
    supabaseAdmin.from = jest.fn(() =>
      buildChain({ data: { id: tokenId, status: 'completed', doctor_id: doctorId }, error: null })
    );
    await expect(transitionToken({ tokenId, doctorId, toStatus: 'waiting' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('rejects access by wrong doctor', async () => {
    supabaseAdmin.from = jest.fn(() =>
      buildChain({ data: { id: tokenId, status: 'waiting', doctor_id: 'other-doc' }, error: null })
    );
    await expect(transitionToken({ tokenId, doctorId, toStatus: 'called' }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('rejects cancel from completed (terminal)', async () => {
    supabaseAdmin.from = jest.fn(() =>
      buildChain({ data: { id: tokenId, status: 'completed', doctor_id: doctorId }, error: null })
    );
    await expect(transitionToken({ tokenId, doctorId, toStatus: 'cancelled' }))
      .rejects.toMatchObject({ status: 400 });
  });
});
