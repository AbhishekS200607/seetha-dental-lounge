const router = require('express').Router();

router.use('/auth',    require('./authRoutes'));
router.use('/admin',   require('./adminRoutes'));
router.use('/doctor',  require('./doctorRoutes'));
router.use('/patient', require('./patientRoutes'));

module.exports = router;
