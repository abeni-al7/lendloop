// Creates the two demo users in your Clerk development instance.
// Usage: node --env-file=.env.local scripts/create-demo-users.mjs
// Clerk test emails (+clerk_test) accept the verification code 424242.
import { createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const password = process.env.DEMO_PASSWORD ?? "lendloop-demo-2026";

const users = [
  { firstName: "Jordan", email: "jordan+clerk_test@example.com" },
  { firstName: "Casey", email: "casey+clerk_test@example.com" },
];

for (const u of users) {
  const existing = await clerk.users.getUserList({ emailAddress: [u.email] });
  if (existing.data.length) {
    console.log(`${u.email} already exists`);
    continue;
  }
  await clerk.users.createUser({
    firstName: u.firstName,
    lastName: "Demo",
    emailAddress: [u.email],
    password,
    skipPasswordChecks: true,
  });
  console.log(`created ${u.email}`);
}
