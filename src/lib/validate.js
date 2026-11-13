const { str, normPhone } = require('./util');

// Validates the client intake form. Returns { data, errors }.
function validateClient(input = {}, { requireConsent = true, staff = false } = {}) {
  const f = {
    name: str(input.name, 120), phone: str(input.phone, 30), email: str(input.email, 160).toLowerCase(),
    age: str(input.age, 3), concerns: str(input.concerns, 1500), allergies: str(input.allergies, 1500),
    pregnant: str(input.pregnant, 5), medications: str(input.medications ?? input.meds, 1000), notes: str(input.notes, 1500),
  };
  const E = {};
  if (f.name.length < 2) E.name = 'Please enter your full name.';
  else if (!/^[A-Za-zÀ-ÿñÑ.\-' ]{2,}$/.test(f.name)) E.name = "Names can only contain letters, spaces and . - '";
  if (!/^09\d{9}$/.test(normPhone(f.phone))) E.phone = 'Enter a valid PH mobile number, e.g. 0927 650 7729.';
  if (f.email || !staff) if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) E.email = 'Please enter a valid email like name@example.com.';
  if (!staff) {
    const a = Number(f.age);
    if (!f.age || !(a >= 12 && a <= 100)) E.age = 'Please enter an age between 12 and 100.';
    else if (a < 18) E.age = 'Clients under 18 need a parent or guardian. Please call us to book.';
    if (f.concerns.length < 3) E.concerns = "Tell us briefly what you'd like help with.";
    if (!f.allergies) E.allergies = 'Please list allergies/conditions, or write “None”.';
    if (!['Yes', 'No'].includes(f.pregnant)) E.preg = 'Please choose Yes or No.';
    if (!f.medications) E.meds = 'Please list medications, or write “None”.';
  }
  if (requireConsent) {
    if (input.c1 !== true) E.c1 = 'Please accept the data privacy agreement to continue.';
    if (input.c2 !== true) E.c2 = 'Please accept the treatment disclaimer to continue.';
  }
  return { data: { ...f, age: f.age ? Number(f.age) : null }, errors: E };
}
module.exports = { validateClient };
