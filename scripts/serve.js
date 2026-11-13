import http from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=process.argv[2]==='dist'?path.join(project,'dist'):project;
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad URL');return;}
 const filename=path.resolve(root,'.'+p);
 if(!(filename===root||filename.startsWith(root+path.sep))){res.writeHead(403).end('Forbidden');return;}
 const file=existsSync(filename)&&statSync(filename).isDirectory()?path.join(filename,'index.html'):filename;
 if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'});
 createReadStream(file).pipe(res);
});
server.listen(port,'0.0.0.0',()=>console.log(`LAIFU ready at http://localhost:${port}`));
