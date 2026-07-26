(function(){
  var root=document.documentElement, btn=document.getElementById('themeBtn'), tTxt=document.getElementById('tTxt');
  function apply(t){root.setAttribute('data-theme',t);tTxt.textContent=t==='dark'?'Dark':'Light';}
  var saved=localStorage.getItem('vh-theme');
  if(saved){apply(saved);} else {apply(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
  btn.addEventListener('click',function(){var t=root.getAttribute('data-theme')==='dark'?'light':'dark';apply(t);localStorage.setItem('vh-theme',t);});
  document.getElementById('yr').textContent=new Date().getFullYear();

  // assemble contact email at runtime (light obfuscation against scrapers)
  (function(){var el=document.getElementById('emailLink');if(!el)return;
    var user='varunhiremath', dom='gmail.com', addr=user+'@'+dom;
    el.setAttribute('href','mailto:'+addr);el.setAttribute('rel','nofollow');})();
  // GitHub link is a placeholder until a handle is provided
  (function(){var g=document.getElementById('ghLink');if(!g)return;
    g.addEventListener('click',function(e){if(g.getAttribute('href')==='#')e.preventDefault();});})();

  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});

  /* ============================================================
     HERO — realistic turbofan cutaway running on a GPU.
     Static structure (nacelle, spinner, fan, multi-stage
     compressor/turbine, annular combustor, tail cone) is
     pre-rendered once to an offscreen canvas for performance.
     Animated live: bypass + core streamlines, combustor flame,
     injected fuel molecules, GPU compute beams, ambient glyphs.
     ============================================================ */
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var c=document.getElementById('flow'), ctx=c.getContext('2d');
  var W,H,DPR,t=0,raf,mobile=false,eng=null;
  var ax0,ax1,cy,Rmax,cbx,gpu={};
  var byp=[],core=[],flame=[],fuel=[],glyphs=[];
  var TAU=Math.PI*2, cos=Math.cos, sin=Math.sin;

  var stops=[[18,10,52],[92,60,220],[255,60,150],[255,150,50],[255,232,150]];
  function cmap(v){v=v<0?0:v>1?1:v;var s=v*(stops.length-1),i=s|0,f=s-i,
    a=stops[i],b=stops[Math.min(i+1,stops.length-1)];
    return [(a[0]+(b[0]-a[0])*f)|0,(a[1]+(b[1]-a[1])*f)|0,(a[2]+(b[2]-a[2])*f)|0];}
  function rgba(c,a){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}

  /* radius profiles (fraction of Rmax vs station s in [0,1]) */
  var P={
    naceOut:[[0,0.60],[0.05,0.82],[0.11,1.0],[0.24,0.96],[0.42,0.86],[0.60,0.74],[0.78,0.62]],
    naceIn: [[0.03,0.50],[0.11,0.76],[0.24,0.76],[0.42,0.68],[0.60,0.60],[0.78,0.54]],
    coreOut:[[0.16,0.30],[0.20,0.46],[0.30,0.48],[0.46,0.46],[0.60,0.48],[0.68,0.46],[0.80,0.40],[0.90,0.31],[1,0.22]],
    gas:    [[0.17,0.22],[0.21,0.38],[0.30,0.34],[0.46,0.26],[0.50,0.33],[0.66,0.33],[0.72,0.26],[0.82,0.32],[0.90,0.24],[1,0.13]],
    hub:    [[0.10,0.09],[0.21,0.15],[0.30,0.19],[0.50,0.20],[0.66,0.20],[0.80,0.16],[0.92,0.06],[1,0.0]]
  };
  function prof(p,s){for(var i=0;i<p.length-1;i++){if(s<=p[i+1][0]){
      var u=(s-p[i][0])/(p[i+1][0]-p[i][0]);u=u<0?0:u>1?1:u;u=u*u*(3-2*u);
      return p[i][1]+(p[i+1][1]-p[i][1])*u;}}return p[p.length-1][1];}
  function sx(s){return ax0+s*(ax1-ax0);}
  function R(name,s){return prof(P[name],s)*Rmax;}
  function lobeC(s){return (prof(P.hub,s)+prof(P.gas,s))*0.5*Rmax;} // combustor lobe centre radius
  function temp(s){if(s<0.49)return 0.10+(s/0.49)*0.24;
    if(s<0.57)return 0.34+((s-0.49)/0.08)*0.66;return Math.max(0.72,1.0-(s-0.57)*0.55);}

  function hash(x,y){var n=sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}

  var TOKENS=["∂u/∂t+(u·∇)u=−∇p/ρ+ν∇²u","∇·u = 0","CH₄ + 2O₂ → CO₂ + 2H₂O",
    "__global__ void solve()","MPI_Allreduce(&r,…)","#pragma omp parallel","CFL < 1","dY/dt = ω̇(Y,T)"];

  function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}

  function layout(){
    mobile=W<760;
    if(mobile){ax0=W*0.02;ax1=W*1.0;cy=H*0.37;Rmax=Math.min(H*0.155,W*0.32);}
    else{ax0=W*0.33;ax1=W*1.08;cy=H*0.44;Rmax=Math.min(H*0.24,W*0.165);}
    cbx=sx(0.565);
    var gw=Math.min(mobile?W*0.7:W*0.42,520), gh=Math.min(mobile?H*0.11:H*0.15,116);
    var gx=cbx-gw*0.5; gx=Math.max(gx,W*0.06); gx=Math.min(gx,W-gw-10);
    var gy=mobile?H*0.66:H*0.8, dw=gh*0.6, dx=gx+gw*0.5-dw/2, dy=gy+gh*0.22;
    gpu={gx:gx,gy:gy,gw:gw,gh:gh,dx:dx,dy:dy,dw:dw,cx:dx+dw/2,topY:dy};
  }

  /* ---------- offscreen static engine ---------- */
  function ribbon(g,inName,outName,s0,s1,sign){
    g.beginPath();var st=52,i,s;
    g.moveTo(sx(s0),cy+sign*R(outName,s0));
    for(i=1;i<=st;i++){s=s0+(s1-s0)*i/st;g.lineTo(sx(s),cy+sign*R(outName,s));}
    for(i=st;i>=0;i--){s=s0+(s1-s0)*i/st;g.lineTo(sx(s),cy+sign*R(inName,s));}
    g.closePath();
  }
  function metal(g,sign){
    var top=cy+sign*Rmax*1.05, gr=g.createLinearGradient(0,cy,0,top);
    gr.addColorStop(0,'#26273250');gr.addColorStop(0.45,'#3c3d4c');gr.addColorStop(0.8,'#22232e');gr.addColorStop(1,'#14141c');
    return gr;
  }
  function edge(g){g.strokeStyle='rgba(198,203,225,0.5)';g.lineWidth=1.3;g.stroke();}

  function stage(g,s,inName,outName,count,stag,col,lw){
    for(var side=-1;side<=1;side+=2){
      var x=sx(s),ri=R(inName,s),ro=R(outName,s);
      g.strokeStyle=col;g.lineWidth=lw;g.lineCap='round';
      for(var i=0;i<count;i++){var fr=i/(count-1),yy=cy+side*(ri+(ro-ri)*fr);
        g.beginPath();g.moveTo(x-lw*1.4,yy+stag);g.lineTo(x+lw*1.4,yy-stag);g.stroke();}
    }
    g.lineCap='butt';
  }

  function combLiner(g,sign){
    // annular combustor lobe: rounded liner around lobe centre, dome at front
    var s0=0.50,s1=0.655,st=26,i,s;
    var outR=function(s){return prof(P.gas,s)*Rmax*0.99;};
    var inR =function(s){return (prof(P.hub,s)*Rmax)*1.05 + Rmax*0.02;};
    g.beginPath();
    // dome front (semi-circle from inner to outer at s0)
    var xd=sx(s0), yo=cy+sign*outR(s0), yi=cy+sign*inR(s0), ym=(yo+yi)/2, rd=Math.abs(yo-yi)/2;
    g.moveTo(sx(s1),cy+sign*outR(s1));
    for(i=st;i>=0;i--){s=s0+(s1-s0)*i/st;g.lineTo(sx(s),cy+sign*outR(s));} // outer wall back→front
    g.arc(xd,ym,rd,sign<0?-Math.PI/2:Math.PI/2, sign<0?-3*Math.PI/2:3*Math.PI/2, sign<0); // dome
    for(i=0;i<=st;i++){s=s0+(s1-s0)*i/st;g.lineTo(sx(s),cy+sign*inR(s));} // inner wall front→back
    g.closePath();
    g.fillStyle='rgba(40,26,20,0.55)';g.fill();
    g.strokeStyle='rgba(255,180,110,0.65)';g.lineWidth=1.4;g.stroke();
    // dilution holes along outer wall
    g.fillStyle='rgba(255,150,70,0.7)';
    for(i=1;i<st;i+=3){s=s0+(s1-s0)*i/st;var hx=sx(s),hy=cy+sign*outR(s);
      g.beginPath();g.arc(hx,hy,1.4,0,TAU);g.fill();}
    // fuel injector at dome
    g.fillStyle='rgba(160,235,255,0.9)';
    g.beginPath();g.moveTo(xd-6,ym-4);g.lineTo(xd-6,ym+4);g.lineTo(xd+3,ym);g.closePath();g.fill();
    g.fillStyle='rgba(120,140,170,0.9)';g.fillRect(xd-12,ym-2.5,7,5);
  }

  function buildEngine(){
    eng=document.createElement('canvas');eng.width=Math.max(1,W*DPR);eng.height=Math.max(1,H*DPR);
    var g=eng.getContext('2d');g.setTransform(DPR,0,0,DPR,0,0);g.clearRect(0,0,W,H);

    // shaft
    g.fillStyle='#1a1b24';rr(g,sx(0.1),cy-R('hub',0.5)*0.34,sx(0.9)-sx(0.1),R('hub',0.5)*0.68,3);g.fill();

    // core casing (bypass inner) both sides
    for(var sg=-1;sg<=1;sg+=2){ribbon(g,'gas','coreOut',0.16,1.0,sg);g.fillStyle=metal(g,sg);g.fill();edge(g);}

    // nacelle / fan cowl both sides
    for(sg=-1;sg<=1;sg+=2){ribbon(g,'naceIn','naceOut',0.0,0.78,sg);g.fillStyle=metal(g,sg);g.fill();edge(g);}
    // rounded inlet lip
    g.strokeStyle='rgba(210,214,235,0.6)';g.lineWidth=2;
    g.beginPath();g.arc(sx(0.02),cy-(R('naceOut',0)+R('naceIn',0.03))/2*0+ (cy-cy),0,0,0);
    g.beginPath();
    g.moveTo(sx(0.02),cy-R('naceIn',0.03));
    g.quadraticCurveTo(sx(-0.01),cy-R('naceOut',0)*0.8,sx(0.05),cy-R('naceOut',0.05));
    g.stroke();
    g.beginPath();
    g.moveTo(sx(0.02),cy+R('naceIn',0.03));
    g.quadraticCurveTo(sx(-0.01),cy+R('naceOut',0)*0.8,sx(0.05),cy+R('naceOut',0.05));
    g.stroke();

    // spinner nose cone
    g.beginPath();g.moveTo(sx(0.055),cy);
    g.lineTo(sx(0.12),cy-R('hub',0.12));g.lineTo(sx(0.135),cy);g.lineTo(sx(0.12),cy+R('hub',0.12));g.closePath();
    var spg=g.createLinearGradient(sx(0.05),cy-20,sx(0.14),cy+20);
    spg.addColorStop(0,'#4a4b58');spg.addColorStop(1,'#1b1c24');g.fillStyle=spg;g.fill();
    g.strokeStyle='rgba(210,214,235,0.5)';g.lineWidth=1;g.stroke();

    // fan (large blades from hub to nacelle inner)
    (function(){var s=0.115,x=sx(s),ri=R('hub',s),ro=R('naceIn',0.11)*0.98;
      g.strokeStyle='rgba(206,210,235,0.75)';g.lineWidth=2.4;g.lineCap='round';var n=mobile?12:18;
      for(var side=-1;side<=1;side+=2)for(var i=0;i<n;i++){var fr=i/(n-1),y=cy+side*(ri+(ro-ri)*fr);
        g.beginPath();g.moveTo(x-7,y+8);g.quadraticCurveTo(x,y,x+7,y-8);g.stroke();}
      g.lineCap='butt';})();

    // booster / LP compressor
    stage(g,0.20,'hub','gas',7,4,'rgba(200,205,230,0.6)',2);
    stage(g,0.235,'hub','gas',8,4,'rgba(200,205,230,0.55)',2);
    // HP compressor (converging, more blades)
    stage(g,0.30,'hub','gas',9,5,'rgba(196,201,226,0.6)',1.8);
    stage(g,0.35,'hub','gas',11,5,'rgba(196,201,226,0.55)',1.6);
    stage(g,0.40,'hub','gas',13,5,'rgba(196,201,226,0.5)',1.5);
    stage(g,0.45,'hub','gas',14,5,'rgba(196,201,226,0.45)',1.4);
    // HP + LP turbine (fewer, larger, hot tint)
    stage(g,0.685,'hub','gas',9,6,'rgba(255,170,90,0.7)',2.2);
    stage(g,0.72,'hub','gas',8,7,'rgba(255,150,70,0.65)',2.6);
    stage(g,0.77,'hub','gas',7,8,'rgba(255,140,60,0.6)',3);

    // combustor liner (both lobes)
    combLiner(g,-1);combLiner(g,1);

    // tail / exhaust cone
    g.beginPath();g.moveTo(sx(0.80),cy-R('hub',0.80));g.lineTo(sx(1.0),cy);g.lineTo(sx(0.80),cy+R('hub',0.80));g.closePath();
    var tg=g.createLinearGradient(0,cy-30,0,cy+30);tg.addColorStop(0,'#3a3b48');tg.addColorStop(1,'#16161e');
    g.fillStyle=tg;g.fill();g.strokeStyle='rgba(200,205,225,0.4)';g.lineWidth=1;g.stroke();

    // centreline
    g.strokeStyle='rgba(255,255,255,0.07)';g.setLineDash([5,7]);g.lineWidth=1;
    g.beginPath();g.moveTo(sx(0.02),cy);g.lineTo(sx(0.99),cy);g.stroke();g.setLineDash([]);

    // labels
    g.font='700 '+(mobile?9:11)+'px ui-monospace,Menlo,monospace';g.textAlign='center';
    g.fillStyle='rgba(255,185,95,0.95)';g.fillText('◄ COMBUSTOR',cbx,cy-R('coreOut',0.57)-10);
    g.fillStyle='rgba(190,184,214,0.5)';
    g.fillText('FAN',sx(0.115),cy-R('naceOut',0.11)-8);
    g.fillText('COMPRESSOR',sx(0.36),cy+R('coreOut',0.36)+15);
    g.fillText('BYPASS DUCT',sx(0.5),cy-R('naceIn',0.5)-7);
    g.fillText('TURBINE',sx(0.73),cy-R('coreOut',0.73)-8);
    g.fillText('NOZZLE',sx(0.93),cy+R('coreOut',0.9)+15);
    g.textAlign='left';
  }

  /* ---------- animated layers ---------- */
  function seed(){
    byp=[];var nb=mobile?60:120;
    for(var i=0;i<nb;i++)byp.push({s:Math.random()*0.66+0.11,fr:Math.random(),side:Math.random()<0.5?-1:1});
    core=[];var nc=mobile?90:180;
    for(i=0;i<nc;i++)core.push({s:Math.random(),fr:Math.random(),side:Math.random()<0.5?-1:1});
    flame=[];for(i=0;i<140;i++)flame.push(newFlame());
    fuel=[];var nf=mobile?4:8;for(i=0;i<nf;i++)fuel.push(newFuel(i));
    glyphs=[];var ng=mobile?5:9;
    for(i=0;i<ng;i++)glyphs.push({txt:TOKENS[(Math.random()*TOKENS.length)|0],
      x:W*0.4+Math.random()*W*0.6,y:Math.random()*H,vx:-0.1-Math.random()*0.18,
      size:11+Math.random()*3,a:0.05+Math.random()*0.08});
  }
  function newFlame(){var side=Math.random()<0.5?-1:1;
    return {s:0.5+Math.random()*0.02,side:side,fr:Math.random(),life:0,max:34+Math.random()*40,sp:0.0016+Math.random()*0.0016};}
  function newFuel(i){var side=i%2===0?-1:1;
    return {x:sx(0.5),y:cy+side*lobeC(0.5),side:side,rot:Math.random()*TAU,burn:0};}

  function coreY(s,side,fr){var ri=R('hub',s),ro=R('gas',s);return cy+side*(ri+(ro-ri)*fr);}
  function bypY(s,side,fr){var ri=R('coreOut',s),ro=R('naceIn',s);return cy+side*(ri+(ro-ri)*fr);}

  function resize(){
    DPR=Math.min(devicePixelRatio||1,2);W=c.clientWidth;H=c.clientHeight;
    c.width=W*DPR;c.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle='#07060f';ctx.fillRect(0,0,W,H);
    layout();buildEngine();seed();
  }

  function drawBypass(dt){
    ctx.globalCompositeOperation='lighter';ctx.lineWidth=1;
    for(var i=0;i<byp.length;i++){var p=byp[i];
      var x0=sx(p.s),y0=bypY(p.s,p.side,p.fr);
      p.s+=0.0026*dt;if(p.s>0.79){p.s=0.11;p.fr=Math.random();continue;}
      var x1=sx(p.s),y1=bypY(p.s,p.side,p.fr);
      ctx.strokeStyle=rgba(cmap(0.16+p.fr*0.12),0.4);
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    }
  }
  function drawCore(dt){
    ctx.globalCompositeOperation='lighter';ctx.lineWidth=1.05;
    for(var i=0;i<core.length;i++){var p=core[i];
      var tp=temp(p.s),x0=sx(p.s),y0=coreY(p.s,p.side,p.fr);
      if(p.s>0.5&&p.s<0.72)y0+=sin(x0*0.06+t*11+p.fr*7)*R('gas',p.s)*0.14*p.side;
      p.s+=0.0016*(0.6+tp*1.7)*dt;
      if(p.s>1.02){p.s=0.16;p.fr=Math.random();continue;}
      var x1=sx(p.s),y1=coreY(p.s,p.side,p.fr);
      if(p.s>0.5&&p.s<0.72)y1+=sin(x1*0.06+t*11+p.fr*7)*R('gas',p.s)*0.14*p.side;
      ctx.strokeStyle=rgba(cmap(0.1+tp*0.9),0.5);
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    }
  }
  function drawCombGlow(){
    ctx.globalCompositeOperation='lighter';
    var pulse=0.7+0.3*(0.5+0.5*sin(t*3.2));
    for(var side=-1;side<=1;side+=2){var yc=cy+side*lobeC(0.57);
      var g=ctx.createRadialGradient(cbx,yc,0,cbx,yc,Rmax*0.34);
      g.addColorStop(0,'rgba(255,238,175,'+(0.85*pulse)+')');
      g.addColorStop(0.3,'rgba(255,150,45,'+(0.5*pulse)+')');
      g.addColorStop(0.7,'rgba(255,50,120,0.18)');g.addColorStop(1,'rgba(120,40,220,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cbx,yc,Rmax*0.32,Rmax*0.2,0,0,TAU);ctx.fill();
    }
  }
  function drawFlames(dt){
    ctx.globalCompositeOperation='lighter';
    for(var i=0;i<flame.length;i++){var f=flame[i];f.life+=dt;f.s+=f.sp*dt;
      if(f.life>f.max||f.s>0.7){flame[i]=newFlame();continue;}
      var ri=R('hub',f.s),ro=R('gas',f.s),x=sx(f.s),y=cy+f.side*(ri+(ro-ri)*f.fr);
      y+=sin(x*0.07+t*13+f.fr*8)*(ro-ri)*0.4;
      var k=f.life/f.max,a=(1-k)*0.5,col=cmap(0.95-k*0.35),rad=1.3+k*3;
      var g=ctx.createRadialGradient(x,y,0,x,y,rad*2);
      g.addColorStop(0,rgba(col,a));g.addColorStop(1,rgba(col,0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rad*2,0,TAU);ctx.fill();
    }
  }
  function drawMolecule(x,y,rot,scale,bright){
    ctx.lineWidth=1;ctx.strokeStyle=rgba([150,225,255],bright);
    for(var k=0;k<4;k++){var a=rot+k/4*TAU+(k%2?0.5:0),hx=x+cos(a)*scale,hy=y+sin(a)*scale;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(hx,hy);ctx.stroke();
      ctx.fillStyle=rgba([180,235,255],bright);ctx.beginPath();ctx.arc(hx,hy,1.5,0,TAU);ctx.fill();}
    ctx.fillStyle=rgba([120,200,255],bright);ctx.beginPath();ctx.arc(x,y,2.4,0,TAU);ctx.fill();
  }
  function drawFuel(dt){
    var tx=sx(0.56);
    for(var i=0;i<fuel.length;i++){var f=fuel[i];
      if(f.burn>0){f.burn-=dt;ctx.globalCompositeOperation='lighter';
        var b=f.burn/16,col=cmap(0.85),g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,15*(1-b)+5);
        g.addColorStop(0,rgba(col,0.6*b));g.addColorStop(1,rgba(col,0));
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,15*(1-b)+5,0,TAU);ctx.fill();
        if(f.burn<=0){var nf=newFuel(i);f.x=nf.x;f.y=nf.y;f.side=nf.side;}continue;}
      var yc=cy+f.side*lobeC(f.x<sx(0.53)?0.5:0.55);
      f.x+=1.0*dt;f.y+=(yc-f.y)*0.06;f.rot+=0.03*dt;
      ctx.globalCompositeOperation='source-over';
      drawMolecule(f.x,f.y,f.rot,mobile?5:6.5,0.85);
      if(f.x>=tx){f.burn=16;}
    }
  }
  function drawGPU(){
    var g=gpu;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(11,16,22,0.92)';rr(ctx,g.gx,g.gy,g.gw,g.gh,10);ctx.fill();
    ctx.strokeStyle='rgba(31,209,196,0.4)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='rgba(255,199,64,0.5)';
    for(var i=0;i<18;i++)ctx.fillRect(g.gx+g.gw*0.12+i*(g.gw*0.5/18),g.gy+g.gh,3,5);
    ctx.fillStyle='rgba(24,30,40,0.95)';
    rr(ctx,g.gx+g.gw*0.06,g.gy+g.gh*0.2,g.gw*0.12,g.gh*0.5,3);ctx.fill();
    rr(ctx,g.gx+g.gw*0.82,g.gy+g.gh*0.2,g.gw*0.12,g.gh*0.5,3);ctx.fill();
    ctx.fillStyle='rgba(7,9,13,1)';rr(ctx,g.dx,g.dy,g.dw,g.dw,4);ctx.fill();
    ctx.strokeStyle='rgba(122,255,240,0.45)';ctx.lineWidth=1;ctx.stroke();
    var cells=6,cw=g.dw/cells,scan=(t*2.0)%1*cells;
    for(var r0=0;r0<cells;r0++)for(var cc=0;cc<cells;cc++){var lit=Math.abs(cc-scan)<0.9?0.55:0.12;
      ctx.fillStyle=rgba([60,220,200],lit*0.5);ctx.fillRect(g.dx+cc*cw+1,g.dy+r0*cw+1,cw-2,cw-2);}
    ctx.fillStyle='rgba(190,255,248,0.85)';ctx.textAlign='center';
    ctx.font='700 '+(mobile?9:11)+'px ui-monospace,Menlo,monospace';ctx.fillText('GPU',g.cx,g.gy-6);
    ctx.fillStyle='rgba(150,200,220,0.6)';ctx.font=(mobile?8:9)+'px ui-monospace,Menlo,monospace';
    ctx.fillText('solver kernels',g.cx,g.gy+g.gh+16);ctx.textAlign='left';
  }
  function drawBeams(){
    ctx.globalCompositeOperation='lighter';
    for(var i=0;i<3;i++){var ox=(i-1)*(gpu.dw*0.5);
      var x0=gpu.cx+ox,y0=gpu.topY,x1=cbx+ox*0.5,y1=cy+lobeC(0.57);
      var grd=ctx.createLinearGradient(x0,y0,x1,y1);
      grd.addColorStop(0,'rgba(60,220,200,0)');grd.addColorStop(0.15,'rgba(60,220,200,0.28)');
      grd.addColorStop(1,'rgba(255,150,60,0.28)');ctx.strokeStyle=grd;ctx.lineWidth=1.2;
      ctx.beginPath();ctx.moveTo(x0,y0);var steps=10;
      for(var k=1;k<=steps;k++){var u=k/steps,wob=sin(u*6+t*5+i)*8*(1-u);ctx.lineTo(x0+(x1-x0)*u+wob,y0+(y1-y0)*u);}
      ctx.stroke();
      var pu=(t*0.8+i*0.33)%1,px=x0+(x1-x0)*pu+sin(pu*6+t*5+i)*8*(1-pu),py=y0+(y1-y0)*pu;
      ctx.fillStyle='rgba(150,255,240,0.8)';ctx.beginPath();ctx.arc(px,py,1.8,0,TAU);ctx.fill();
    }
  }
  function drawGlyphs(dt){
    ctx.globalCompositeOperation='source-over';ctx.textBaseline='middle';ctx.textAlign='left';
    for(var i=0;i<glyphs.length;i++){var g=glyphs[i];g.x+=g.vx*dt;
      if(g.x<W*0.34){g.x=W+80;g.y=Math.random()*H;}
      var e=Math.min(1,Math.max(0,(g.x-W*0.42)/(W*0.12))),a=g.a*e;if(a<=0.004)continue;
      ctx.fillStyle=rgba([170,160,205],a);ctx.font=g.size+'px ui-monospace,Menlo,Consolas,monospace';
      ctx.fillText(g.txt,g.x,g.y);}
  }

  function frame(){
    t+=0.0016;
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#07060f';ctx.fillRect(0,0,W,H);
    drawGPU();drawBeams();
    ctx.globalCompositeOperation='source-over';ctx.drawImage(eng,0,0,W,H);
    drawBypass(1);drawCore(1);
    drawCombGlow();drawFlames(1);drawFuel(1);
    drawGlyphs(1);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    raf=requestAnimationFrame(frame);
  }
  function staticFrame(){
    ctx.fillStyle='#07060f';ctx.fillRect(0,0,W,H);
    drawGPU();drawBeams();ctx.drawImage(eng,0,0,W,H);
    for(var k=0;k<50;k++){t+=0.0012;drawBypass(1.2);drawCore(1.2);}
    drawCombGlow();for(var j=0;j<70;j++)drawFlames(1);
    drawGlyphs(1);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  }

  function start(){resize();cancelAnimationFrame(raf);if(reduce){staticFrame();}else{frame();}}
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(start,180);});
  start();
})();
