// ============================================
// MongoDB Initialization Script
// Runs on first container startup
// ============================================

// Switch to minlish database
db = db.getSiblingDB('minlish');

// Create collections with validators
print('Initializing Minlish database...');

// ─────────────────────────────────────────────
// User Collection
// ─────────────────────────────────────────────
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role', 'isActive', 'createdAt', 'updatedAt'],
      properties: {
        email: { bsonType: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
        password: { bsonType: 'string', minLength: 6 },
        role: { enum: ['user', 'admin'] },
        isActive: { bsonType: 'bool' },
        isBanned: { bsonType: 'bool' },
        isEmailVerified: { bsonType: 'bool' }
      }
    }
  }
});

// Create indexes for users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ createdAt: -1 });

// ─────────────────────────────────────────────
// Vocabulary Set Collection
// ─────────────────────────────────────────────
db.createCollection('vocabularysets');
db.vocabularysets.createIndex({ owner: 1 });
db.vocabularysets.createIndex({ isPublic: 1 });
db.vocabularysets.createIndex({ tags: 1 });
db.vocabularysets.createIndex({ createdAt: -1 });

// ─────────────────────────────────────────────
// Word Collection
// ─────────────────────────────────────────────
db.createCollection('words');
db.words.createIndex({ vocabularySet: 1 });
db.words.createIndex({ word: 1 });
db.words.createIndex({ owner: 1 });

// ─────────────────────────────────────────────
// Learning Progress Collection (SM-2)
// ─────────────────────────────────────────────
db.createCollection('learningprogresses');
db.learningprogresses.createIndex({ user: 1 });
db.learningprogresses.createIndex({ word: 1 });
db.learningprogresses.createIndex({ user: 1, word: 1 }, { unique: true });
db.learningprogresses.createIndex({ nextReviewDate: 1 });

// ─────────────────────────────────────────────
// Daily Stats Collection
// ─────────────────────────────────────────────
db.createCollection('dailystats');
db.dailystats.createIndex({ user: 1, date: 1 }, { unique: true });
db.dailystats.createIndex({ date: -1 });

// ─────────────────────────────────────────────
// Notifications Collection
// ─────────────────────────────────────────────
db.createCollection('notifications');
db.notifications.createIndex({ user: 1 });
db.notifications.createIndex({ user: 1, isRead: 1 });
db.notifications.createIndex({ createdAt: -1 });

// ─────────────────────────────────────────────
// Posts Collection (Social)
// ─────────────────────────────────────────────
db.createCollection('posts');
db.posts.createIndex({ author: 1 });
db.posts.createIndex({ isPublic: 1 });
db.posts.createIndex({ createdAt: -1 });

// ─────────────────────────────────────────────
// Comments Collection
// ─────────────────────────────────────────────
db.createCollection('comments');
db.comments.createIndex({ post: 1 });
db.comments.createIndex({ author: 1 });
db.comments.createIndex({ createdAt: -1 });

// ─────────────────────────────────────────────
// FCM Tokens Collection
// ─────────────────────────────────────────────
db.createCollection('fcmtokens');
db.fcmtokens.createIndex({ user: 1, token: 1 }, { unique: true });

// ─────────────────────────────────────────────
// Admin Audit Log Collection
// ─────────────────────────────────────────────
db.createCollection('adminauditlogs');
db.adminauditlogs.createIndex({ admin: 1 });
db.adminauditlogs.createIndex({ action: 1 });
db.adminauditlogs.createIndex({ createdAt: -1 });

// ─────────────────────────────────────────────
// System Config Collection
// ─────────────────────────────────────────────
db.createCollection('systemconfigs');
db.systemconfigs.createIndex({ key: 1 }, { unique: true });

// ─────────────────────────────────────────────
# Seed Initial Data
// ─────────────────────────────────────────────
print('Seeding initial data...');

// Default system configs
db.systemconfigs.insertMany([
  { key: 'maintenance_mode', value: false, updatedAt: new Date() },
  { key: 'max_vocab_sets_per_user', value: 100, updatedAt: new Date() },
  { key: 'daily_new_words_limit', value: 20, updatedAt: new Date() }
]);

print('✓ Minlish database initialized successfully!');
