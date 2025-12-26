# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=98.87.193.253
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=VtdRRY3GtqBWyFZz7ww4

# JWT Configuration
JWT_SECRET=p4K!d9F@vL2$xQ1zR7mC8tW0sB$yH6nE3jUuK^aT*fP&O
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=Z9q$W4eF!rT8%uI1mB6&kS3dA7@pV0nL$hC*oG^xY$QwE
JWT_REFRESH_EXPIRES_IN=30d

# Frontend URL (for CORS & Emails)
#https://prod.d199ohr0jh1wjk.amplifyapp.com
FRONTEND_URL=https://instinctxai.com

# Community URL (for CORS)
COMMUNITY_URL=https://community.instinctxai.com

# AWS S3
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID-
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY-
AWS_REGION=us-east-1
S3_BUCKET_UPLOADS=instinctx-uploads

# AWS Email (SES)
AWS_SES_REGION=us-east-1
AWS_SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
AWS_SES_SMTP_PORT=587
AWS_SES_SMTP_USERNAME=<your-smtp-username>
AWS_SES_SMTP_PASSWORD=<your-smtp-password>
EMAIL_FROM=info@instinctxai.com
EMAIL_FROM_NAME=InstinctX

# true/false (true: emails enabled)
ENABLE_EMAILS=true
