require('dotenv').config();
const axios = require('axios');

const BASE_URL = `http://localhost:${process.env.PORT || 4000}`;

async function testAPI() {
    console.log('🧪 Testing Video Conferencing API...\n');

    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check:', healthResponse.data.status);

        // Test API info endpoint
        console.log('\n2. Testing API info endpoint...');
        const apiResponse = await axios.get(`${BASE_URL}/api`);
        console.log('✅ API info:', apiResponse.data.name);

        // Test user registration
        console.log('\n3. Testing user registration...');
        const testUser = {
            email: `test${Date.now()}@example.com`,
            name: 'Test User',
            password: 'testpassword123'
        };

        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        console.log('✅ User registered:', registerResponse.data.user.email);

        const { accessToken } = registerResponse.data.tokens;

        // Test user login
        console.log('\n4. Testing user login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('✅ User logged in:', loginResponse.data.user.email);

        // Test authenticated endpoint
        console.log('\n5. Testing authenticated endpoint...');
        const profileResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        console.log('✅ Profile fetched:', profileResponse.data.user.name);

        // Test meeting creation
        console.log('\n6. Testing meeting creation...');
        const meetingData = {
            title: 'Test Meeting',
            description: 'This is a test meeting',
            settings: {
                isPublic: true,
                allowChat: true,
                maxParticipants: 50
            }
        };

        const meetingResponse = await axios.post(`${BASE_URL}/api/meetings`, meetingData, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        console.log('✅ Meeting created:', meetingResponse.data.meeting.title);

        // Test getting meetings
        console.log('\n7. Testing get meetings...');
        const meetingsResponse = await axios.get(`${BASE_URL}/api/meetings`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        console.log('✅ Meetings fetched:', meetingsResponse.data.meetings.length, 'meetings');

        // Test room creation (legacy WebRTC support)
        console.log('\n8. Testing room creation...');
        const roomResponse = await axios.post(`${BASE_URL}/api/rooms`, {
            hostName: 'Test Host',
            hostId: registerResponse.data.user.id
        });
        console.log('✅ Room created:', roomResponse.data.roomId);

        console.log('\n🎉 All API tests passed successfully!');
        console.log('\n📊 Test Summary:');
        console.log('   ✅ Health check');
        console.log('   ✅ API info');
        console.log('   ✅ User registration');
        console.log('   ✅ User login');
        console.log('   ✅ Authentication');
        console.log('   ✅ Meeting creation');
        console.log('   ✅ Meeting retrieval');
        console.log('   ✅ Room creation (WebRTC)');

    } catch (error) {
        console.error('\n❌ API test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }

        console.log('\n🔍 Troubleshooting:');
        console.log('   1. Make sure the server is running (npm run dev)');
        console.log('   2. Check database connection');
        console.log('   3. Verify environment variables');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testAPI();
}

module.exports = { testAPI };