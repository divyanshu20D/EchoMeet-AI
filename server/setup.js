require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Video Conferencing Server...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env file from .env.example...');
    fs.copyFileSync(path.join(__dirname, '.env.example'), envPath);
    console.log('✅ .env file created. Please update it with your database credentials.\n');

    console.log('⚠️  IMPORTANT: Update the following in your .env file:');
    console.log('   - DATABASE_URL: Your PostgreSQL connection string');
    console.log('   - JWT_SECRET: A secure random string');
    console.log('   - JWT_REFRESH_SECRET: Another secure random string\n');

    console.log('Example DATABASE_URL:');
    console.log('DATABASE_URL="postgresql://username:password@localhost:5432/video_conferencing_db"\n');

    process.exit(0);
}

try {
    console.log('🔧 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('\n📊 Pushing database schema...');
    execSync('npx prisma db push', { stdio: 'inherit' });

    console.log('\n✅ Setup completed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Test the API: http://localhost:4000/health');
    console.log('   3. View database: npm run db:studio');

} catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Make sure PostgreSQL is running');
    console.log('   2. Check your DATABASE_URL in .env file');
    console.log('   3. Ensure the database exists');
    process.exit(1);
}