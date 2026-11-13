// Create an admin, or reset the password of an existing user.
// Usage: npm run create-admin -- you@example.com "Your Name" "StrongPassword123"
const { query, migrate, pool } = require('../src/db');
const { hash, checkPassword } = require('../src/lib/auth');
(async () => {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) { console.log('Usage: npm run create-admin -- email "Full Name" "Password123"'); process.exit(1); }
  const err = checkPassword(password); if (err) { console.error(err); process.exit(1); }
  await migrate();
  await query(`INSERT INTO users(email, name, role, password_hash, active) VALUES ($1,$2,'admin',$3,true)
               ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role='admin', active=true, name=EXCLUDED.name`,
    [email.toLowerCase(), name, await hash(password)]);
  console.log(`Admin ready: ${email}`); await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
