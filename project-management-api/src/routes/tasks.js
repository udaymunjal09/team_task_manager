const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');
const { isProjectMember, isProjectAdmin } = require('../middleware/projectAccess');

const router = express.Router();

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private (Project members only)
router.post('/', protect, [
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('project').isMongoId().withMessage('Valid project ID is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('dueDate').optional().isISO8601().withMessage('Invalid date format'),
  body('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
  handleValidation
], async (req, res) => {
  try {
    const { title, description, project, priority, dueDate, assignedTo } = req.body;

    // Check project exists and user is a member
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!projectDoc.isProjectMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project'
      });
    }

    // If assignedTo is provided, verify they are a project member
    if (assignedTo && !projectDoc.isProjectMember(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user is not a member of this project'
      });
    }

    const task = await Task.create({
      title,
      description,
      project,
      priority,
      dueDate,
      assignedTo,
      createdBy: req.user._id
    });

    await task.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'project', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message
    });
  }
});

// @route   GET /api/tasks
// @desc    Get all tasks for user (across all projects)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Get all projects user is a member of
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    }).select('_id');

    const projectIds = projects.map(p => p._id);

    // Build query
    let query = { project: { $in: projectIds } };

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by priority
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // Filter by assigned to me
    if (req.query.assignedToMe === 'true') {
      query.assignedTo = req.user._id;
    }

    // Filter by project
    if (req.query.project) {
      query.project = req.query.project;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
});

// @route   GET /api/tasks/project/:projectId
// @desc    Get all tasks for a specific project
// @access  Private (Project members only)
router.get('/project/:projectId', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!project.isProjectMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project'
      });
    }

    let query = { project: req.params.projectId };

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by priority
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // Filter by assignee
    if (req.query.assignedTo) {
      query.assignedTo = req.query.assignedTo;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get a single task
// @access  Private (Project members only)
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check project membership
    const project = await Project.findById(task.project);
    if (!project.isProjectMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching task',
      error: error.message
    });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private (Project members can update status, admins can update all)
router.put('/:id', protect, [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('status').optional().isIn(['todo', 'in-progress', 'review', 'completed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('dueDate').optional().isISO8601().withMessage('Invalid date format'),
  body('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
  handleValidation
], async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const project = await Project.findById(task.project);
    
    if (!project.isProjectMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project'
      });
    }

    const isAdmin = project.isProjectAdmin(req.user._id);
    const isAssignee = task.assignedTo && task.assignedTo.toString() === req.user._id.toString();
    const isCreator = task.createdBy.toString() === req.user._id.toString();

    // Members can only update status if they're assigned or created the task
    if (!isAdmin && !isAssignee && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only task assignee, creator, or project admin can update this task'
      });
    }

    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    // Non-admins can only update status
    if (!isAdmin) {
      if (title || description !== undefined || priority || dueDate || assignedTo) {
        return res.status(403).json({
          success: false,
          message: 'Only project admins can update task details other than status'
        });
      }
    }

    // Validate assignedTo is a project member
    if (assignedTo && !project.isProjectMember(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user is not a member of this project'
      });
    }

    // Update fields
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = dueDate;
    if (assignedTo !== undefined) task.assignedTo = assignedTo || null;

    await task.save();

    await task.populate([
      { path: 'assignedTo', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'project', select: 'name' }
    ]);

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message
    });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private (Project admin or task creator only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const project = await Project.findById(task.project);
    
    const isAdmin = project.isProjectAdmin(req.user._id);
    const isCreator = task.createdBy.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only project admin or task creator can delete this task'
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message
    });
  }
});

module.exports = router;
