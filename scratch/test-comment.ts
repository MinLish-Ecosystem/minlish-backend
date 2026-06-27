import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';
import { Post } from '../src/models/Post';
import { signAccessToken } from '../src/utils/jwt.util';

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || 'mongodb://localhost:27017/minlish';
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('Database connected.');

  try {
    const user = await User.findOne();
    if (!user) {
      console.log('No user found in database.');
      return;
    }
    console.log('Found user:', user.email, 'Role:', user.role);

    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });
    console.log('Signed token:', token.substring(0, 15) + '...');

    const post = await Post.findOne();
    if (!post) {
      console.log('No post found in database.');
      return;
    }
    console.log('Found post:', post._id, post.title);

    const baseURL = 'http://localhost:3000/api/v1';
    console.log('Sending comment request to API...');
    const commentRes = await fetch(`${baseURL}/posts/${post._id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        content: 'This is a test comment from the database-bypassed diagnostic script!'
      })
    });

    const commentData = await commentRes.json();
    console.log('Response status:', commentRes.status);
    console.log('Response data:', JSON.stringify(commentData, null, 2));
  } catch (err: any) {
    console.error('Error occurred:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

run();
