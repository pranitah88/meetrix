// ============================================================
// Meetrix — MongoDB Collection Schemas
// Database: meetrix
// ============================================================

// ── COLLECTION: users ────────────────────────────────────────
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password"],
      properties: {
        _id:       { bsonType: "objectId" },
        name:      { bsonType: "string",  description: "Full display name" },
        email:     { bsonType: "string",  description: "Unique email address" },
        password:  { bsonType: "string",  description: "bcrypt hashed password" },
        avatar:    { bsonType: "string",  description: "URL or base64 avatar" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

db.users.createIndex({ email: 1 }, { unique: true });


// ── COLLECTION: meetings ──────────────────────────────────────
// Tasks and Insights are embedded inside each meeting document
// because they are always accessed in the context of a meeting.
// Participants (attendees) are references to users.

db.createCollection("meetings", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "date", "createdBy"],
      properties: {
        _id:       { bsonType: "objectId" },
        title:     { bsonType: "string" },
        date:      { bsonType: "date" },
        agenda:    { bsonType: "string" },
        attendees: {
          bsonType: "array",
          items: { bsonType: "objectId", description: "Ref: users._id" }
        },
        decisions: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        tasks: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["description", "assignee"],
            properties: {
              _id:         { bsonType: "objectId" },
              description: { bsonType: "string" },
              assignee:    { bsonType: "objectId", description: "Ref: users._id" },
              deadline:    { bsonType: "date" },
              status:      { enum: ["Open", "In Progress", "Completed"] },
              createdAt:   { bsonType: "date" },
              updatedAt:   { bsonType: "date" }
            }
          }
        },
        insights: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["topic", "author", "text"],
            properties: {
              _id:       { bsonType: "objectId" },
              topic:     { bsonType: "string" },
              author:    { bsonType: "objectId", description: "Ref: users._id" },
              text:      { bsonType: "string" },
              createdAt: { bsonType: "date" },
              updatedAt: { bsonType: "date" }
            }
          }
        },
        aiSummary: { bsonType: ["string", "null"] },
        createdBy: { bsonType: "objectId", description: "Ref: users._id" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Indexes
db.meetings.createIndex({ date: -1 });
db.meetings.createIndex({ attendees: 1 });
db.meetings.createIndex({ "tasks.assignee": 1, "tasks.status": 1 });
db.meetings.createIndex({ createdBy: 1, date: -1 });
