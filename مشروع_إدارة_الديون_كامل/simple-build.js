#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function copyFiles(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  
  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyFiles(srcPath, destPath);
    } else if (stat.isFile() && (item.endsWith('.html') || item.endsWith('.css') || item.endsWith('.js'))) {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

try {
  console.log('Building application...');
  
  // Create dist directory
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist', { recursive: true });
  }
  
  // Copy files
  if (fs.existsSync('./index.html')) {
    fs.copyFileSync('./index.html', './dist/index.html');
  }
  
  if (fs.existsSync('./src')) {
    copyFiles('./src', './dist/src');
  }
  
  if (fs.existsSync('./public')) {
    copyFiles('./public', './dist/public');
  }
  
  console.log('Build completed successfully!');
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
