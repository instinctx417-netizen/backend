const TrainingVideo = require('../models/TrainingVideo');
const Quiz = require('../models/Quiz');
const QuizAnswer = require('../models/QuizAnswer');
const User = require('../models/User');

/**
 * Training Videos - Admin only
 */

// Get all training videos
exports.getVideos = async (req, res) => {
  try {
    const videos = await TrainingVideo.findAll();
    res.json({
      success: true,
      data: { videos },
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Create training video - Admin only
exports.createVideo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create training videos',
      });
    }

    const { title, youtubeUrl, displayOrder } = req.body;

    if (!title || !youtubeUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title and YouTube URL are required',
      });
    }

    // Extract video ID from YouTube URL
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL',
      });
    }

    const video = await TrainingVideo.create({
      title,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      displayOrder: displayOrder || 0,
      createdByUserId: req.userId,
    });

    res.json({
      success: true,
      message: 'Training video created successfully',
      data: { video },
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update training video - Admin only
exports.updateVideo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update training videos',
      });
    }

    const { id } = req.params;
    const { title, youtubeUrl, displayOrder } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (youtubeUrl !== undefined) {
      const videoId = extractYouTubeVideoId(youtubeUrl);
      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid YouTube URL',
        });
      }
      updateData.youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    const video = await TrainingVideo.update(id, updateData);

    res.json({
      success: true,
      message: 'Training video updated successfully',
      data: { video },
    });
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete training video - Admin only
exports.deleteVideo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete training videos',
      });
    }

    const { id } = req.params;
    const video = await TrainingVideo.delete(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    res.json({
      success: true,
      message: 'Training video deleted successfully',
    });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Quizzes - Admin only for management, Staff can view and answer
 */

// Get all quizzes
exports.getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.findAll();
    const user = await User.findById(req.userId);

    // If staff, include their answers and exclude correct_answer from quizzes
    let answers = [];
    let sanitizedQuizzes = quizzes;
    if (user.user_type === 'candidate') {
      const QuizAnswerModel = require('../models/QuizAnswer');
      answers = await QuizAnswerModel.findByUser(req.userId);
      
      // Remove correct_answer field for staff users
      sanitizedQuizzes = quizzes.map(quiz => {
        const { correct_answer, ...quizWithoutAnswer } = quiz;
        return quizWithoutAnswer;
      });
    }

    res.json({
      success: true,
      data: { quizzes: sanitizedQuizzes, answers },
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Create quiz - Admin only
exports.createQuiz = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create quizzes',
      });
    }

    const { question, optionA, optionB, optionC, optionD, correctAnswer } = req.body;

    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (!['A', 'B', 'C', 'D'].includes(correctAnswer.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Correct answer must be A, B, C, or D',
      });
    }

    const quiz = await Quiz.create({
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer: correctAnswer.toUpperCase(),
      createdByUserId: req.userId,
    });

    res.json({
      success: true,
      message: 'Quiz created successfully',
      data: { quiz },
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update quiz - Admin only (increments version)
exports.updateQuiz = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update quizzes',
      });
    }

    const { id } = req.params;
    const { question, optionA, optionB, optionC, optionD, correctAnswer } = req.body;

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (optionA !== undefined) updateData.optionA = optionA;
    if (optionB !== undefined) updateData.optionB = optionB;
    if (optionC !== undefined) updateData.optionC = optionC;
    if (optionD !== undefined) updateData.optionD = optionD;
    if (correctAnswer !== undefined) {
      if (!['A', 'B', 'C', 'D'].includes(correctAnswer.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Correct answer must be A, B, C, or D',
        });
      }
      updateData.correctAnswer = correctAnswer.toUpperCase();
    }

    const quiz = await Quiz.update(id, updateData);

    res.json({
      success: true,
      message: 'Quiz updated successfully (version incremented)',
      data: { quiz },
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete quiz - Admin only
exports.deleteQuiz = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete quizzes',
      });
    }

    const { id } = req.params;
    const quiz = await Quiz.delete(id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    res.json({
      success: true,
      message: 'Quiz deleted successfully',
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Submit quiz answer - Staff only
exports.submitQuizAnswer = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.user_type !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Only staff can submit quiz answers',
      });
    }

    const { quizId, selectedAnswer } = req.body;

    if (!quizId || !selectedAnswer) {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID and selected answer are required',
      });
    }

    if (!['A', 'B', 'C', 'D'].includes(selectedAnswer.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Selected answer must be A, B, C, or D',
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    const isCorrect = quiz.correct_answer.toUpperCase() === selectedAnswer.toUpperCase();
    const quizVersion = quiz.version;

    const answer = await QuizAnswer.create({
      quizId,
      userId: req.userId,
      selectedAnswer: selectedAnswer.toUpperCase(),
      quizVersion,
      isCorrect,
    });

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      data: { answer, isCorrect },
    });
  } catch (error) {
    console.error('Submit quiz answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get quiz stats for staff
exports.getQuizStats = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const targetUserId = req.query.userId ? parseInt(req.query.userId) : req.userId;
    
    // Allow staff to view their own stats, or admin to view any staff's stats
    if (user.user_type === 'candidate' && targetUserId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own quiz stats',
      });
    }
    
    if (user.user_type !== 'candidate' && user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only staff and admins can view quiz stats',
      });
    }

    const stats = await QuizAnswer.getStatsByUser(targetUserId);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('Get quiz stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Helper function to extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

