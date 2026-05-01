const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');
const { isProjectMember, isProjectAdmin, isProjectOwner } = require('../middleware/projectAccess');

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

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', protect, [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('description').optional().trim(),
  body('endDate').optional().isISO8601().withMessage('Invalid date format'),
  handleValidation
], async (req, res) => {
  try {
    const { name, description, endDate } = req.body;

    const project = await Project.create({
      name,
      description,
      endDate,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }]
    });

    await project.populate('owner', 'name email');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: error.message
    });
  }
});

// @route   GET /api/projects
// @desc    Get all projects for the user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    })
    .populate('owner', 'name email')
    .populate('members.user', 'name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
});

// @route   GET /api/projects/:id
// @desc    Get a single project
// @access  Private (Project members only)
router.get('/:id', protect, isProjectMember, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching project',
      error: error.message
    });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update a project
// @access  Private (Project admin only)
router.put('/:id', protect, isProjectAdmin, [
  body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty'),
  body('status').optional().isIn(['active', 'completed', 'on-hold', 'cancelled']),
  body('endDate').optional().isISO8601().withMessage('Invalid date format'),
  handleValidation
], async (req, res) => {
  try {
    const { name, description, status, endDate } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (status) updateFields.status = status;
    if (endDate) updateFields.endDate = endDate;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    )
    .populate('owner', 'name email')
    .populate('members.user', 'name email');

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating project',
      error: error.message
    });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete a project
// @access  Private (Project owner only)
router.delete('/:id', protect, isProjectOwner, async (req, res) => {
  try {
    // Delete all tasks associated with the project
    await Task.deleteMany({ project: req.params.id });
    
    // Delete the project
    await Project.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Project and associated tasks deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting project',
      error: error.message
    });
  }
});

// @route   POST /api/projects/:id/members
// @desc    Add a member to the project
// @access  Private (Project admin only)
router.post('/:id/members', protect, isProjectAdmin, [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member'),
  handleValidation
], async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    const project = await Project.findById(req.params.id);

    // Check if user is already a member
    const isMember = project.members.some(m => m.user.toString() === user._id.toString());
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this project'
      });
    }

    // Add member
    project.members.push({ user: user._id, role });
    await project.save();

    await project.populate('members.user', 'name email');

    res.json({
      success: true,
      message: 'Member added successfully',
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding member',
      error: error.message
    });
  }
});

// @route   PUT /api/projects/:id/members/:memberId
// @desc    Update member role
// @access  Private (Project admin only)
router.put('/:id/members/:memberId', protect, isProjectAdmin, [
  body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member'),
  handleValidation
], async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    const memberIndex = project.members.findIndex(
      m => m.user.toString() === req.params.memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this project'
      });
    }

    // Cannot change owner's role
    if (project.owner.toString() === req.params.memberId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change the role of the project owner'
      });
    }

    project.members[memberIndex].role = req.body.role;
    await project.save();

    await project.populate('members.user', 'name email');

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating member role',
      error: error.message
    });
  }
});

// @route   DELETE /api/projects/:id/members/:memberId
// @desc    Remove a member from the project
// @access  Private (Project admin only)
router.delete('/:id/members/:memberId', protect, isProjectAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    // Cannot remove owner
    if (project.owner.toString() === req.params.memberId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the project owner'
      });
    }

    const memberIndex = project.members.findIndex(
      m => m.user.toString() === req.params.memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this project'
      });
    }

    project.members.splice(memberIndex, 1);
    await project.save();

    // Unassign tasks from removed member
    await Task.updateMany(
      { project: req.params.id, assignedTo: req.params.memberId },
      { $unset: { assignedTo: 1 } }
    );

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing member',
      error: error.message
    });
  }
});

module.exports = router;
