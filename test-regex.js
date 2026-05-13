const names = [
  "[13U] 7250 IXR-10.svg",
  "[2U] 7250 IXR-R4.svg",
  "[4U] 7250 IXR-R6d.svg"
];
names.forEach(f => {
  console.log(f.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, ""));
});
