const { exec } = require('child_process');

console.log('بدء البناء من الصفر...');

exec('rm -rf dist && npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error('خطأ في البناء:', error);
    return;
  }
  if (stderr) {
    console.error('تحذيرات:', stderr);
  }
  console.log(stdout);
  console.log('تم البناء بنجاح!');
});