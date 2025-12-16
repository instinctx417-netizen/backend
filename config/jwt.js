require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'p4K!d9F@vL2$xQ1zR7mC8tW0sB$yH6nE3jUuK^aT*fP&O',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'Z9q$W4eF!rT8%uI1mB6&kS3dA7@pV0nL$hC*oG^xY$QwE',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
};

