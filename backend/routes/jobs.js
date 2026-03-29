const express = require('express');
const router = express.Router();
const { Job, ChaosEvent } = require('../models/schemas');

// GET /api/jobs - Get all jobs with filtering
router.get('/', async (req, res) => {
  try {
    const { status, repository, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

    let query = {};
    if (status) query.status = status;
    if (repository) query.repository = repository;

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const jobs = await Job.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        current: parseInt(page),
        total: pages,
        count: total,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/jobs/:jobId - Get single job by ID
router.get('/:jobId', async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/jobs - Create new job
router.post('/', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/jobs/:jobId - Update job status/metrics
router.patch('/:jobId', async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { jobId: req.params.jobId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/jobs/:jobId/chaos-events - Get chaos events for a job
router.get('/:jobId/chaos-events', async (req, res) => {
  try {
    const events = await ChaosEvent.find({ jobId: req.params.jobId }).sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/jobs/:jobId/chaos-events - Log a chaos event
router.post('/:jobId/chaos-events', async (req, res) => {
  try {
    const event = new ChaosEvent({
      ...req.body,
      jobId: req.params.jobId
    });
    await event.save();
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/jobs/status/summary - Get status summary (counts)
router.get('/status/summary', async (req, res) => {
  try {
    const summary = await Job.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      PASS: 0,
      BLOCKED: 0,
      RUNNING: 0,
      PENDING: 0,
      FAILED: 0
    };

    summary.forEach(item => {
      result[item._id] = item.count;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
