(function(){
  var root=document.documentElement;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme toggle ---------- */
  var btn=document.getElementById('themeBtn'), tTxt=document.getElementById('tTxt');
  function apply(t){root.setAttribute('data-theme',t);if(tTxt)tTxt.textContent=(t==='dark'?'Dark':'Light');}
  var saved=localStorage.getItem('vh-theme');
  apply(saved || 'light');   // light is the default; dark is opt-in via the toggle
  if(btn)btn.addEventListener('click',function(){
    var t=root.getAttribute('data-theme')==='dark'?'light':'dark';apply(t);localStorage.setItem('vh-theme',t);
  });

  /* ---------- footer year ---------- */
  var yr=document.getElementById('yr');if(yr)yr.textContent=new Date().getFullYear();

  /* ---------- contact links ---------- */
  (function(){
    var addr='varunhiremath'+'@'+'gmail.com';
    document.querySelectorAll('.js-email').forEach(function(el){
      el.setAttribute('href','mailto:'+addr);el.setAttribute('rel','nofollow');
    });
  })();

  /* ---------- scroll reveals ---------- */
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});

  /* ---------- header solidifies on scroll ---------- */
  var header=document.getElementById('site-header');
  function onScroll(){if(header)header.classList.toggle('scrolled',window.scrollY>8);}
  onScroll();addEventListener('scroll',onScroll,{passive:true});

  /* ---------- scroll-spy: highlight active nav link ---------- */
  (function(){
    var links=Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
    var map={};links.forEach(function(a){
      var id=a.getAttribute('href');if(id&&id.charAt(0)==='#'&&id.length>1){
        var sec=document.querySelector(id);if(sec)map[id.slice(1)]=a;}
    });
    var sections=Object.keys(map).map(function(id){return document.getElementById(id);});
    if(!sections.length)return;
    function setActive(id){links.forEach(function(a){
      var on=a.getAttribute('href')==='#'+id;
      a.classList.toggle('active',on);
      if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');
    });}
    var spy=new IntersectionObserver(function(entries){
      entries.forEach(function(en){if(en.isIntersecting)setActive(en.target.id);});
    },{rootMargin:'-45% 0px -50% 0px',threshold:0});
    sections.forEach(function(s){spy.observe(s);});
  })();

  /* ---------- hero: typed / rotating line ---------- */
  (function(){
    var el=document.getElementById('rot');if(!el)return;
    var words=[
      'am a Software Developer',
      'am an Aerospace Engineer',
      'am a Principal Software Engineer',
      'build CFD solvers for jet engines',
      'write scientific-computing software',
      'simulate turbulent combustion',
      'scale code across thousands of cores',
      'am a Debian Developer',
      'am a Pickleball Player',
      'am a Nature Enthusiast',
      'enjoy traveling & the outdoors',
      'am a lifelong learner'
    ];
    if(reduce){el.textContent=words[0];return;}
    var wi=0,ci=0,deleting=false;
    function tick(){
      var w=words[wi];
      el.textContent=w.slice(0,ci);
      if(!deleting){
        ci++;
        if(ci>w.length){deleting=true;return setTimeout(tick,1400);}
        return setTimeout(tick,55);
      } else {
        ci--;
        if(ci<0){deleting=false;wi=(wi+1)%words.length;ci=0;return setTimeout(tick,220);}
        return setTimeout(tick,28);
      }
    }
    tick();
  })();
})();
