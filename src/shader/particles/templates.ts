// Multi-pass curl noise particle shader (al-ro, MIT 2023).
// Ported from Shadertoy. WebGL2 / GLSL ES 3.0 required (texelFetch).
// See docs/particles.js for the runtime renderer.

export const particleCommonGlsl = `
#define RENDER_SCALE (iResolution.x < 2048.0 ? 0.5 : 0.25)
#define PI 3.14159
#define TWO_PI (2.0 * PI)
#define GAMMA 2.2
#define INV_GAMMA (1.0 / GAMMA)

void pixarONB(vec3 n, out vec3 b1, out vec3 b2){
  float sign_ = n.z >= 0.0 ? 1.0 : -1.0;
  float a = -1.0 / (sign_ + n.z);
  float b = n.x * n.y * a;
  b1 = vec3(1.0 + sign_ * n.x * n.x * a, sign_ * b, -sign_ * n.x);
  b2 = vec3(b, sign_ + n.y * n.y * a, -n.y);
}

vec3 gamma(vec3 col){
  return pow(col, vec3(INV_GAMMA));
}

float saturate(float x){
  return clamp(x, 0.0, 1.0);
}
`;

export const particleBufferAGlsl = `
#define CAMERA_DIST 16.0

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if ((fragCoord.x == 0.5) && (fragCoord.y < 4.0)) {
    vec4 oldData = texelFetch(iChannel0, ivec2(0, 0), 0).xyzw;
    vec2 oldPolarAngles = oldData.xy;
    vec2 oldMouse = oldData.zw;
    vec2 polarAngles = vec2(0);
    vec2 mouse = iMouse.xy / iResolution.xy;
    float angleEps = 0.01;
    float mouseDownLastFrame = texelFetch(iChannel0, ivec2(0, 3), 0).x;
    if (iMouse.z > 0.0 && mouseDownLastFrame > 0.0) {
      vec2 mouseMove = mouse - oldMouse;
      polarAngles = oldPolarAngles + vec2(5.0, 3.0) * mouseMove;
    } else {
      polarAngles = oldPolarAngles;
    }
    polarAngles.x = mod(polarAngles.x, 2.0 * PI - angleEps);
    polarAngles.y = min(PI - angleEps, max(angleEps, polarAngles.y));
    if (fragCoord == vec2(0.5, 0.5)) {
      if (iFrame < 10) { polarAngles = vec2(2.9, 1.7); mouse = vec2(0); }
      fragColor = vec4(polarAngles, mouse);
    }
    if (fragCoord == vec2(0.5, 1.5)) {
      vec3 cameraPos = normalize(vec3(
        -cos(polarAngles.x) * sin(polarAngles.y),
         cos(polarAngles.y),
        -sin(polarAngles.x) * sin(polarAngles.y)));
      fragColor = vec4(CAMERA_DIST * cameraPos, 1.0);
    }
    if (fragCoord == vec2(0.5, 2.5)) {
      float resolutionChangeFlag = 0.0;
      vec2 oldResolution = texelFetch(iChannel0, ivec2(0, 2), 0).yz;
      if (iResolution.xy != oldResolution) { resolutionChangeFlag = 1.0; }
      fragColor = vec4(resolutionChangeFlag, iResolution.xy, 1.0);
    }
    if (fragCoord == vec2(0.5, 3.5)) {
      fragColor = iMouse.z > 0.0 ? vec4(vec3(1.0), 1.0) : vec4(vec3(0.0), 1.0);
    }
  }
}
`;

export const particleBufferBGlsl = `
const float speed = 3.0;
const float scale = 0.15;
const float particleCount = 2048.0;
const float boundingRadius = 10.0;
const float spawnRadius = 4.0;

vec3 fade(vec3 t){ return (t*t*t)*(t*(t*6.0-15.0)+10.0); }

vec3 hash(vec3 p3){
  p3 = fract(p3 * vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yxz+33.33);
  return 2.0*fract((p3.xxy+p3.yxx)*p3.zyx)-1.0;
}

vec3 hash32(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yxz+33.33);
  return fract((p3.xxy+p3.yzz)*p3.zyx);
}

float noise(vec3 p){
  p += 1e-4*iTime;
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = fade(f);
  return mix(
    mix(mix(dot(hash(i+vec3(0,0,0)),f-vec3(0,0,0)),dot(hash(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
        mix(dot(hash(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(hash(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
    mix(mix(dot(hash(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(hash(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
        mix(dot(hash(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(hash(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);
}

vec3 computeCurl(vec3 p){
  const float eps = 1e-4;
  float dx=noise(p+vec3(eps,0,0))-noise(p-vec3(eps,0,0));
  float dy=noise(p+vec3(0,eps,0))-noise(p-vec3(0,eps,0));
  float dz=noise(p+vec3(0,0,eps))-noise(p-vec3(0,0,eps));
  vec3 g0=vec3(dx,dy,dz)/(2.0*eps);
  p+=1000.5;
  dx=noise(p+vec3(eps,0,0))-noise(p-vec3(eps,0,0));
  dy=noise(p+vec3(0,eps,0))-noise(p-vec3(0,eps,0));
  dz=noise(p+vec3(0,0,eps))-noise(p-vec3(0,0,eps));
  vec3 g1=vec3(dx,dy,dz)/(2.0*eps);
  return normalize(cross(g0,g1));
}

vec4 getInitialPosition(vec2 fc){
  return vec4(spawnRadius*(2.0*hash32(fc)-1.0),0.0);
}

void main(){
  vec2 fragCoord = gl_FragCoord.xy;
  if((floor(fragCoord.y)*iResolution.x+floor(fragCoord.x))<particleCount){
    if(iFrame==0){ fragColor=getInitialPosition(fragCoord); }
    else{
      float iTimeLastFrame=texelFetch(iChannel0,ivec2(0,0),0).x;
      float dT=iTime-iTimeLastFrame;
      vec4 oldData=texelFetch(iChannel0,ivec2(fragCoord),0);
      vec3 oldPos=oldData.rgb;
      oldPos+=speed*dT*computeCurl(scale*oldPos);
      vec4 newPos=vec4(oldPos,oldData.w+dT);
      if(length(newPos)>boundingRadius){ newPos=getInitialPosition(fragCoord+iTime); }
      fragColor=newPos;
    }
  } else { fragColor=vec4(vec3(0),1.0); }
  if(fragCoord==vec2(0.5,0.5)){ fragColor=vec4(iTime); }
}
`;

export const particleBufferCGlsl = `
const int particleCount = 300;
const float boundingRadius = 10.0;
const bool trails = false;

vec3 rayDirection(float fov, vec2 fc, vec2 res){
  vec2 xy=fc-res/2.0;
  float z=(0.5*res.y)/tan(radians(fov)/2.0);
  return normalize(vec3(xy,-z));
}
mat3 lookAt(vec3 cam, vec3 td, vec3 up){
  vec3 z=normalize(td); vec3 x=normalize(cross(z,up)); vec3 y=cross(x,z);
  return mat3(x,y,-z);
}
vec3 intersectCoordSys(vec3 ro,vec3 rd,vec3 dc,vec3 du,vec3 dv){
  vec3 oc=ro-dc;
  return vec3(dot(cross(du,dv),oc),dot(cross(oc,du),rd),dot(cross(dv,oc),rd))/dot(cross(dv,du),rd);
}
vec2 intersectAABB(vec3 ro,vec3 rd,vec3 bMin,vec3 bMax){
  vec3 t1=min((bMin-ro)/rd,(bMax-ro)/rd);
  vec3 t2=max((bMin-ro)/rd,(bMax-ro)/rd);
  return vec2(max(max(t1.x,t1.y),t1.z),min(min(t2.x,t2.y),t2.z));
}
bool insideAABB(vec3 p,vec3 mn,vec3 mx){
  float e=1e-4;
  return p.x>mn.x-e&&p.y>mn.y-e&&p.z>mn.z-e&&p.x<mx.x+e&&p.y<mx.y+e&&p.z<mx.z+e;
}
float getGlow(float d,float r,float i){ d=max(d,1e-6); return pow(r/d,i); }
vec3 getColour(float t){
  t+=0.15*iTime;
  vec3 a=vec3(0.65); vec3 b=1.0-a; vec3 c=vec3(1); vec3 d=vec3(0.15,0.5,0.75);
  return a+b*cos(TWO_PI*(c*t+d));
}

vec3 traceParticles(vec3 org,vec3 rd){
  vec3 n=-rd; vec3 tg; vec3 bt;
  pixarONB(n,tg,bt); tg=normalize(tg); bt=normalize(bt);
  vec3 col=vec3(0); float sz=16.0;
  for(int i=1;i<particleCount;i++){
    ivec2 uv=ivec2(int(mod(float(i),iChannelResolution1.x)),i/int(iChannelResolution1.x));
    vec4 data=texelFetch(iChannel1,uv,0);
    vec3 pos=data.xyz; float len=length(pos);
    float s=smoothstep(boundingRadius,0.0,len);
    if(s<1e-5) continue;
    vec3 isect=intersectCoordSys(org,rd,pos,tg,bt);
    float d=dot(isect.yz,isect.yz);
    if(d<sz){
      float gs=mix(1.0,4.0,smoothstep(4.0,0.0,len))*mix(0.001,0.01,0.5+0.5*sin(13.0*iTime+float(i)/6.0));
      vec3 tone=getColour(float(i)/(3.4*float(particleCount)));
      vec3 glow=tone*getGlow(d,gs,mix(1.0,0.9,s));
      col+=smoothstep(0.0,0.5,data.w)*s*glow*smoothstep(sz,0.0,d);
    }
  }
  return col;
}

void main(){
  vec2 fragCoord=gl_FragCoord.xy;
  if(fragCoord.x>iResolution.x*RENDER_SCALE||fragCoord.y>iResolution.y*RENDER_SCALE){
    fragColor=vec4(0); return;
  }
  vec3 rd=rayDirection(60.0,fragCoord,iResolution.xy*RENDER_SCALE);
  vec3 cam=texelFetch(iChannel0,ivec2(0,1),0).xyz;
  mat3 vm=lookAt(cam,-cam,vec3(0,1,0));
  rd=normalize(vm*rd);
  vec3 col=vec3(0.0,0.01,0.02);
  vec2 isect=intersectAABB(cam,rd,vec3(-boundingRadius),vec3(boundingRadius));
  if(isect.x>0.0&&(isect.x<isect.y)||insideAABB(cam,vec3(-boundingRadius),vec3(boundingRadius))){
    col+=traceParticles(cam,rd);
  }
  if(trails&&iMouse.z<0.0){
    vec3 old=clamp(texelFetch(iChannel2,ivec2(fragCoord),0).rgb,0.0,2.0);
    col=mix(old,col,0.45);
  }
  fragColor=vec4(col,1.0);
}
`;

export const particleImageGlsl = `
vec3 ACESFilm(vec3 x){
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);
}
void main(){
  vec2 uv=gl_FragCoord.xy/iResolution.xy;
  vec3 col=texture(iChannel0,RENDER_SCALE*uv).rgb;
  col=ACESFilm(col);
  col=gamma(col);
  fragColor=vec4(col,1.0);
}
`;
