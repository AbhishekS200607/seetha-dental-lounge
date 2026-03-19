const router = require('express').Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const c = require('../controllers/doctorController');

router.use(authenticate, requireRole('doctor'));

router.get('/queue',                  c.getQueue);
router.get('/current',                c.getCurrent);
router.post('/tokens/_/next',         c.callNext);
router.patch('/tokens/:id/start',     c.startToken);
router.patch('/tokens/:id/skip',      c.skipToken);
router.patch('/tokens/:id/recall',    c.recallToken);
router.patch('/tokens/:id/cancel',    c.cancelToken);
router.patch('/tokens/:id/complete',  c.completeToken);

module.exports = router;
