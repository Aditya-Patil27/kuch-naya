const express = require('express');
const router = express.Router();
const { Settings } = require('../models/schemas');

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ settingId: 'global' });
    
    // Create default settings if not exists
    if (!settings) {
      settings = new Settings({
        settingId: 'global',
        github: {
          appInstalled: false,
          webhookVerified: false,
          prAuthor: 'org-members',
          autoMerge: false
        },
        thresholds: {
          p99Latency: 500,
          errorRate: 1,
          throughput: 1000,
          memoryUsage: 80,
          dbPool: 240,
          cacheHitRate: 85
        },
        notifications: {
          onPass: true,
          onBlock: true,
          dailyDigest: false,
          slackEnabled: false,
          emailNotifications: false
        },
        advanced: {
          commandTimeout: 600,
          rampDuration: 120,
          chaosTypes: ['LATENCY_INJECTION', 'PACKET_LOSS', 'POD_TERMINATION'],
          logRetention: 30,
          apiRateLimit: 1000
        }
      });
      await settings.save();
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/settings - Update settings
router.patch('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ settingId: 'global' });
    
    if (!settings) {
      settings = new Settings({ settingId: 'global', ...req.body });
    } else {
      Object.assign(settings, req.body);
      settings.updatedAt = new Date();
    }

    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/settings/github - Update GitHub settings
router.patch('/github', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { settingId: 'global' },
      {
        $set: {
          'github': req.body.github,
          'updatedAt': new Date()
        }
      },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/settings/thresholds - Update performance thresholds
router.patch('/thresholds', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { settingId: 'global' },
      {
        $set: {
          'thresholds': req.body.thresholds,
          'updatedAt': new Date()
        }
      },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /api/settings/notifications - Update notification settings
router.patch('/notifications', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { settingId: 'global' },
      {
        $set: {
          'notifications': req.body.notifications,
          'updatedAt': new Date()
        }
      },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/settings/reset - Reset to defaults
router.post('/reset', async (req, res) => {
  try {
    await Settings.deleteOne({ settingId: 'global' });
    
    const defaultSettings = new Settings({
      settingId: 'global',
      github: {
        appInstalled: false,
        webhookVerified: false,
        prAuthor: 'org-members',
        autoMerge: false
      },
      thresholds: {
        p99Latency: 500,
        errorRate: 1,
        throughput: 1000,
        memoryUsage: 80,
        dbPool: 240,
        cacheHitRate: 85
      },
      notifications: {
        onPass: true,
        onBlock: true,
        dailyDigest: false,
        slackEnabled: false,
        emailNotifications: false
      },
      advanced: {
        commandTimeout: 600,
        rampDuration: 120,
        chaosTypes: ['LATENCY_INJECTION', 'PACKET_LOSS', 'POD_TERMINATION'],
        logRetention: 30,
        apiRateLimit: 1000
      }
    });
    
    await defaultSettings.save();
    res.json({ success: true, data: defaultSettings, message: 'Settings reset to defaults' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
