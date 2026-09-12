export type View = { yaw:number; pitch:number; fov:number };
export const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const vertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 vUV;
uniform vec2 uSize;
uniform vec3 uView;
uniform sampler2D tf;uniform sampler2D tr;uniform sampler2D tb;uniform sampler2D tl;uniform sampler2D tu;uniform sampler2D td;
void main(){
 float yaw=radians(uView.x),pitch=radians(uView.y),t=tan(radians(uView.z)*.5);
 vec2 uv=vUV*uSize/max(uSize.x,uSize.y)*t;
 vec3 fw=vec3(sin(yaw)*cos(pitch),-sin(pitch),cos(yaw)*cos(pitch));
 vec3 rt=vec3(cos(yaw),0.,-sin(yaw));
 vec3 up=vec3(sin(yaw)*sin(pitch),cos(pitch),cos(yaw)*sin(pitch));
 vec3 d=normalize(fw+rt*uv.x+up*uv.y),a=abs(d);vec2 q;vec4 col;
 if(a.z>=a.x&&a.z>=a.y){if(d.z>0.){q=vec2(d.x,-d.y)/a.z;col=texture2D(tf,q*.5+.5);}else{q=vec2(-d.x,-d.y)/a.z;col=texture2D(tb,q*.5+.5);}}
 else if(a.x>=a.y){if(d.x>0.){q=vec2(-d.z,-d.y)/a.x;col=texture2D(tr,q*.5+.5);}else{q=vec2(d.z,-d.y)/a.x;col=texture2D(tl,q*.5+.5);}}
 else{if(d.y>0.){q=vec2(d.x,d.z)/a.y;col=texture2D(tu,q*.5+.5);}else{q=vec2(d.x,-d.z)/a.y;col=texture2D(td,q*.5+.5);}}
 gl_FragColor=vec4(col.rgb,1.);
}`;
export class Panorama {
 private gl:WebGLRenderingContext;private program:WebGLProgram;private textures:WebGLTexture[]=[];private generation=0;private cache=new Map<string,ImageBitmap>();private pending=new Set<AbortController>();
 constructor(private canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false});if(!gl)throw new Error('浏览器暂不支持全景显示，请换用 Chrome 或 Safari。');this.gl=gl;
  const compile=(type:number,source:string)=>{const sh=gl.createShader(type)!;gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'全景初始化失败');return sh;};
  const p=gl.createProgram()!;gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('全景初始化失败');this.program=p;gl.useProgram(p);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const at=gl.getAttribLocation(p,'aPosition');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
  ['f','r','b','l','u','d'].forEach((f,i)=>{const tex=gl.createTexture()!;this.textures.push(tex);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([153,151,145]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1i(gl.getUniformLocation(p,'t'+f),i);});
 }
 private async image(src:string):Promise<ImageBitmap>{
  const cached=this.cache.get(src);if(cached){this.cache.delete(src);this.cache.set(src,cached);return cached;}
  const controller=new AbortController();this.pending.add(controller);
  const timeout=window.setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch(src,{signal:controller.signal});if(!response.ok)throw new Error('全景图片加载失败，请重试。');
   const image=await createImageBitmap(await response.blob());
   if(controller.signal.aborted){image.close();throw new DOMException('Aborted','AbortError');}
   this.cache.set(src,image);
   while(this.cache.size>36){const key=this.cache.keys().next().value!;this.cache.get(key)?.close();this.cache.delete(key);}
   return image;
  }finally{clearTimeout(timeout);this.pending.delete(controller);}
 }
 async load(faces:Record<string,string>,previews?:Record<string,string>,onReady?:()=>void,onDetailError?:()=>void){
  this.canvas.dataset.quality='loading';const gen=++this.generation;for(const c of this.pending)c.abort();this.pending.clear();let shown=false;
  const upload=async(urls:Record<string,string>,quality:string)=>{
   const imgs=await Promise.all(['f','r','b','l','u','d'].map(f=>this.image(urls[f])));
   if(gen!==this.generation)return false;
   const gl=this.gl;imgs.forEach((im,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);});
   this.canvas.dataset.source=faces.f;this.canvas.dataset.quality=quality;
   if(!shown){shown=true;onReady?.();}
   return true;
  };
  if(previews){try{await upload(previews,'preview');}catch{if(gen!==this.generation)return false;}}
  if(gen!==this.generation)return false;
  try{return await upload(faces,'full');}catch(error){if(gen!==this.generation)return false;if(shown){onDetailError?.();return true;}throw error;}
 }
 draw(view:View){const gl=this.gl,rect=this.canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2),w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;gl.viewport(0,0,w,h);}gl.useProgram(this.program);gl.uniform2f(gl.getUniformLocation(this.program,'uSize'),w,h);gl.uniform3f(gl.getUniformLocation(this.program,'uView'),view.yaw,view.pitch,view.fov);gl.drawArrays(gl.TRIANGLES,0,6);}
 dispose(){this.generation++;for(const c of this.pending)c.abort();this.pending.clear();for(const im of this.cache.values())im.close();this.cache.clear();for(const t of this.textures)this.gl.deleteTexture(t);this.gl.deleteProgram(this.program);}
}
export function project(yaw:number,pitch:number,view:View,w:number,h:number){const rad=Math.PI/180,y=yaw*rad,p=pitch*rad,cy=view.yaw*rad,cp=view.pitch*rad;const d=[Math.sin(y)*Math.cos(p),-Math.sin(p),Math.cos(y)*Math.cos(p)];const right=d[0]*Math.cos(cy)-d[2]*Math.sin(cy),up=d[0]*Math.sin(cy)*Math.sin(cp)+d[1]*Math.cos(cp)+d[2]*Math.cos(cy)*Math.sin(cp),forward=d[0]*Math.sin(cy)*Math.cos(cp)-d[1]*Math.sin(cp)+d[2]*Math.cos(cy)*Math.cos(cp);if(forward<=.05)return null;const scale=Math.max(w,h)/(2*Math.tan(view.fov*rad/2));return{x:w/2+right/forward*scale,y:h/2-up/forward*scale};}
