# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name your project (e.g., "HR Management System")
4. Follow the setup wizard

## 2. Get Firebase Configuration

1. In Firebase Console, click the gear icon → Project settings
2. Scroll down to "Your apps" section
3. Click the web icon (</>) to create a web app
4. Copy the `firebaseConfig` object

## 3. Update Firebase Config

Open `src/lib/firebase.ts` and replace the placeholder config with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 4. Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication

## 5. Create Firestore Database

1. Go to **Firestore Database** in Firebase Console
2. Click **Create database**
3. Choose **Start in production mode** (we'll add security rules later)
4. Select your preferred location

## 6. Set Up Firestore Collections & Indexes

The app uses these collections (they'll be created automatically when data is added):
- `employees` - Employee profiles
- `user_roles` - User role assignments
- `attendance` - Attendance records
- `leaves` - Leave applications
- `salary_slips` - Salary information

### ⚠️ IMPORTANT: Create Required Composite Indexes

Firestore requires composite indexes for queries with multiple filters. You MUST create these:

#### Method 1: Click Error Links (Easiest)
When you see "Query requires an index" errors in the console, Firebase provides direct links. Click them to auto-create indexes.

#### Method 2: Manual Creation
Go to **Firestore Database** → **Indexes** → **Composite** and create:

**Index 1: Attendance by Employee and Date**
- Collection ID: `attendance`
- Fields indexed:
  - `employeeId` - Ascending
  - `date` - Ascending
  - `__name__` - Ascending

**Index 2: Leaves by Employee and Date**
- Collection ID: `leaves`
- Fields indexed:
  - `employeeId` - Ascending
  - `createdAt` - Ascending
  - `__name__` - Ascending

**Index 3: Salary Slips by Employee and Month**
- Collection ID: `salary_slips`
- Fields indexed:
  - `employeeId` - Ascending
  - `month` - Ascending
  - `__name__` - Ascending

**Index 4: Attendance by Date (Admin View)**
- Collection ID: `attendance`
- Fields indexed:
  - `date` - Descending
  - `__name__` - Ascending

## 7. Firestore Security Rules

Add these security rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is HR or HOD
    function isAdmin() {
      return exists(/databases/$(database)/documents/user_roles/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/user_roles/$(request.auth.uid)).data.role in ['hr', 'hod'];
    }
    
    // Employees collection
    match /employees/{employeeId} {
      allow read: if request.auth != null;
      allow update: if request.auth.uid == resource.data.userId || isAdmin();
      allow create, delete: if isAdmin();
    }
    
    // User roles
    match /user_roles/{userId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    // Attendance
    match /attendance/{attendanceId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.employeeId;
      allow update: if request.auth.uid == resource.data.employeeId || isAdmin();
      allow delete: if isAdmin();
    }
    
    // Leaves
    match /leaves/{leaveId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.employeeId;
      allow update: if isAdmin();
      allow delete: if request.auth.uid == resource.data.employeeId || isAdmin();
    }
    
    // Salary slips
    match /salary_slips/{slipId} {
      allow read: if request.auth.uid == resource.data.employeeId || isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

## 8. Create Initial Admin User

You'll need to manually create your first HR/HOD user:

1. Go to **Authentication** in Firebase Console
2. Click **Add user**
3. Create a user with email format: `ADMIN@company.local` and password: `ADMIN`
4. Copy the UID of the created user
5. Go to **Firestore Database**
6. Create a document in `user_roles` collection:
   - Document ID: [paste the UID you copied]
   - Fields:
     - `userId`: [same UID]
     - `role`: `hr` (or `hod`)
7. Create a document in `employees` collection:
   - Document ID: auto-generated
   - Fields:
     - `userId`: [same UID]
     - `name`: "Admin User"
     - `employeeCode`: "ADMIN"
     - `email`: "admin@company.com"
     - `phone`: ""
     - `address`: ""
     - `createdAt`: [current timestamp]

## Default Login

Once set up:
- **Employee Code**: Your employee code (e.g., W0115)
- **Password**: Same as employee code on first login
- Employees must change password after first login

## Features Included

✅ Employee Dashboard
- Profile management with photo upload
- Password change
- Attendance tracking with GPS location
- Monthly attendance calendar
- Leave application system
- Salary slip viewing

✅ HR/HOD Dashboard
- Employee management (add, edit, delete)
- Leave approval system
- Attendance monitoring
- Full employee data access

✅ Leave Types (as per specification)
- Earned Leave (EL) - 30 days/year
- Sick Leave (SL) - 7 days/year
- Casual Leave (CL) - 10 days/year
- Maternity Leave (ML) - 182 days
- Paternity Leave (PL) - 15 days
- Compensatory Leave (CO)

## Development

```bash
npm install
npm run dev
```

The app will run at `http://localhost:8080`
