const bcrypt = require('bcryptjs');

bcrypt.hash('123456', 10).then(hash => {
  console.log('Hash de "123456":');
  console.log(hash);
}).catch(err => {
  console.error('Error:', err);
});
