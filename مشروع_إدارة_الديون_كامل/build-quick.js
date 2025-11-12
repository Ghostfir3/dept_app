import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Building application...');
  
  // Copy TypeScript files to dist (quick and dirty build)
  const srcDir = './src';
  const distDir = './dist/assets';
  
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Copy main files
  if (fs.existsSync('./index.html')) {
    fs.copyFileSync('./index.html', './dist/index.html');
  }
  
  if (fs.existsSync('./public')) {
    const publicFiles = fs.readdirSync('./public');
    publicFiles.forEach(file => {
      const srcPath = `./public/${file}`;
      const destPath = `./dist/${file}`;
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }
  
  console.log('Basic build completed. Files copied to dist directory.');
  
} catch (error) {
  console.error('Build error:', error.message);
  process.exit(1);
}
