const Project = require('../models/Project');

// Check if user is a member of the project
exports.isProjectMember = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id || req.body.project;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const project = await Project.findById(projectId);
    
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

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error checking project membership'
    });
  }
};

// Check if user is a project admin
exports.isProjectAdmin = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id || req.body.project;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!project.isProjectAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only project admins can perform this action'
      });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error checking project admin status'
    });
  }
};

// Check if user is project owner
exports.isProjectOwner = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project owner can perform this action'
      });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error checking project ownership'
    });
  }
};
