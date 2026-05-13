const fs = require('fs');
const file = 'src/components/DeviceModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\/\/ 스타일 조정: 최초 1회만 실행 \(해시 비교\)[\s\S]*?if \(container\.dataset\.renderedHash !== currentHash\) \{[\s\S]*?container\.dataset\.renderedHash = currentHash;/,
  `// 스타일 조정: SVG가 교체될 때마다 실행되도록 해시 비교 제거`
);

// We need to also remove the closing brace of the if statement!
// Let's do it more carefully.
