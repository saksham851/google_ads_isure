const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

dotenv.config();

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const email = 'superadmin@isuremedia.com';
        const password = 'adminpassword123';

        let user = await User.findOne({ email });
        if (user) {
            user.role = 'superadmin';
            user.password = password;
            await user.save();
        } else {
            user = new User({ email, password, role: 'superadmin' });
            await user.save();
        }
        console.log(`Updated/Created: ${email} with password: ${password}`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
createAdmin();
