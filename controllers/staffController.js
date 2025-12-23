const SiteStaff = require('../models/SiteStaff');
const User = require('../models/User');

/**
 * Get staff profile (for staff members themselves)
 */
exports.getStaffProfile = async (req, res) => {
  try {
    const staff = await SiteStaff.findActiveByUserId(req.userId);
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff record not found',
      });
    }

    // Parse profile_data if it exists
    let profileData = {};
    if (staff.profile_data) {
      try {
        profileData = typeof staff.profile_data === 'string' 
          ? JSON.parse(staff.profile_data) 
          : staff.profile_data;
      } catch (e) {
        profileData = {};
      }
    }

    res.json({
      success: true,
      data: {
        staff: {
          id: staff.id,
          userId: staff.user_id,
          positionTitle: staff.position_title,
          organizationId: staff.organization_id,
          organizationName: staff.organization_name,
          hiredAt: staff.hired_at,
          profileData: profileData,
        },
      },
    });
  } catch (error) {
    console.error('Get staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Update staff profile data
 */
exports.updateStaffProfile = async (req, res) => {
  try {
    const { favoriteFood, favoriteMovie, hobbies } = req.body;

    // Verify user is staff
    const staff = await SiteStaff.findActiveByUserId(req.userId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff record not found',
      });
    }

    // Build profile data object
    const profileData = {
      favoriteFood: favoriteFood || null,
      favoriteMovie: favoriteMovie || null,
      hobbies: hobbies || null,
    };

    // Update profile data
    const updated = await SiteStaff.updateProfileData(req.userId, profileData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        staff: {
          id: updated.id,
          profileData: profileData,
        },
      },
    });
  } catch (error) {
    console.error('Update staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

