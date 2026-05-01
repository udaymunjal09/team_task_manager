const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/dashboard
// @desc    Get dashboard data for the current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Get all projects user is a member of
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    }).select('_id name status');

    const projectIds = projects.map(p => p._id);

    // Get all tasks for user's projects
    const allTasks = await Task.find({ project: { $in: projectIds } });

    // Get tasks assigned to user
    const myTasks = await Task.find({ 
      project: { $in: projectIds },
      assignedTo: req.user._id 
    })
    .populate('project', 'name')
    .sort({ dueDate: 1 });

    // Calculate overdue tasks
    const now = new Date();
    const overdueTasks = myTasks.filter(task => 
      task.dueDate && 
      new Date(task.dueDate) < now && 
      task.status !== 'completed'
    );

    // Task status breakdown (all tasks)
    const tasksByStatus = {
      todo: allTasks.filter(t => t.status === 'todo').length,
      'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
      review: allTasks.filter(t => t.status === 'review').length,
      completed: allTasks.filter(t => t.status === 'completed').length
    };

    // My tasks by status
    const myTasksByStatus = {
      todo: myTasks.filter(t => t.status === 'todo').length,
      'in-progress': myTasks.filter(t => t.status === 'in-progress').length,
      review: myTasks.filter(t => t.status === 'review').length,
      completed: myTasks.filter(t => t.status === 'completed').length
    };

    // Task priority breakdown
    const tasksByPriority = {
      low: allTasks.filter(t => t.priority === 'low').length,
      medium: allTasks.filter(t => t.priority === 'medium').length,
      high: allTasks.filter(t => t.priority === 'high').length,
      urgent: allTasks.filter(t => t.priority === 'urgent').length
    };

    // Projects status breakdown
    const projectsByStatus = {
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      'on-hold': projects.filter(p => p.status === 'on-hold').length,
      cancelled: projects.filter(p => p.status === 'cancelled').length
    };

    // Recent tasks (last 5)
    const recentTasks = await Task.find({ project: { $in: projectIds } })
      .populate('project', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Upcoming deadlines (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingDeadlines = await Task.find({
      project: { $in: projectIds },
      dueDate: { $gte: now, $lte: nextWeek },
      status: { $ne: 'completed' }
    })
    .populate('project', 'name')
    .populate('assignedTo', 'name')
    .sort({ dueDate: 1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        summary: {
          totalProjects: projects.length,
          totalTasks: allTasks.length,
          myTasks: myTasks.length,
          overdueTasks: overdueTasks.length,
          completedTasks: tasksByStatus.completed
        },
        tasksByStatus,
        myTasksByStatus,
        tasksByPriority,
        projectsByStatus,
        recentTasks,
        upcomingDeadlines,
        overdueTasks: overdueTasks.slice(0, 10).map(t => ({
          _id: t._id,
          title: t.title,
          project: t.project,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/project/:projectId
// @desc    Get dashboard data for a specific project
// @access  Private (Project members only)
router.get('/project/:projectId', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

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

    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    const now = new Date();

    // Task status breakdown
    const tasksByStatus = {
      todo: tasks.filter(t => t.status === 'todo').length,
      'in-progress': tasks.filter(t => t.status === 'in-progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      completed: tasks.filter(t => t.status === 'completed').length
    };

    // Task priority breakdown
    const tasksByPriority = {
      low: tasks.filter(t => t.priority === 'low').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      high: tasks.filter(t => t.priority === 'high').length,
      urgent: tasks.filter(t => t.priority === 'urgent').length
    };

    // Overdue tasks
    const overdueTasks = tasks.filter(t => 
      t.dueDate && 
      new Date(t.dueDate) < now && 
      t.status !== 'completed'
    );

    // Tasks by member
    const tasksByMember = {};
    project.members.forEach(member => {
      const memberTasks = tasks.filter(t => 
        t.assignedTo && t.assignedTo._id.toString() === member.user._id.toString()
      );
      tasksByMember[member.user.name] = {
        total: memberTasks.length,
        completed: memberTasks.filter(t => t.status === 'completed').length,
        inProgress: memberTasks.filter(t => t.status === 'in-progress').length
      };
    });

    // Unassigned tasks
    const unassignedTasks = tasks.filter(t => !t.assignedTo);

    // Progress percentage
    const progressPercentage = tasks.length > 0 
      ? Math.round((tasksByStatus.completed / tasks.length) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        project: {
          _id: project._id,
          name: project.name,
          description: project.description,
          status: project.status,
          owner: project.owner,
          members: project.members,
          startDate: project.startDate,
          endDate: project.endDate
        },
        summary: {
          totalTasks: tasks.length,
          completedTasks: tasksByStatus.completed,
          overdueTasks: overdueTasks.length,
          unassignedTasks: unassignedTasks.length,
          progressPercentage
        },
        tasksByStatus,
        tasksByPriority,
        tasksByMember,
        overdueTasks: overdueTasks.map(t => ({
          _id: t._id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          assignedTo: t.assignedTo
        })),
        unassignedTasks: unassignedTasks.map(t => ({
          _id: t._id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching project dashboard',
      error: error.message
    });
  }
});

module.exports = router;
