function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function publicUsers(users) {
  return users.map(publicUser);
}

module.exports = { publicUser, publicUsers };
