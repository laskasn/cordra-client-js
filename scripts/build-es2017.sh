tsc
sed -e '1 s#^#//#' dist/es2017/index.js > dist/es2017/tmp.js
mv dist/es2017/tmp.js dist/es2017/index.js
