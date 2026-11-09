/* 실시간 따라가기 백엔드 (Firebase Realtime Database + 연습용 Mock)
 *
 * 공통 인터페이스
 *   init()                      -> Promise
 *   onConnection(cb)            cb(true|false)
 *   onAuth(cb)                  cb({email,uid}|null)
 *   signIn(email,pw) / signOut()-> Promise
 *   watchRoom(code,{onState,onResources}) -> unwatch()
 *   setState(code,patch)        -> Promise   (강사만)
 *   addResource(code,item)      -> Promise   (강사만)
 *   removeResource(code,id)     -> Promise   (강사만)
 *
 * 데이터 모양:  rooms/{code}/state     { slide, pushSeq, skip:{번호:1}, at }
 *               rooms/{code}/resources { id: {t,u,i,ts} }
 */
(function(){
  function loadScript(src){
    return new Promise(function(res,rej){
      var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('불러오지 못했어요: '+src))};
      document.head.appendChild(s);
    });
  }
  function validCfg(c){
    return !!(c&&c.databaseURL&&c.apiKey&&c.projectId&&!/YOUR|여기에/i.test(JSON.stringify(c)));
  }

  /* ---------- Firebase ---------- */
  var V='10.12.2',BASE='https://www.gstatic.com/firebasejs/'+V+'/';
  function FirebaseBackend(cfg){this.cfg=cfg;this.db=null;this.auth=null;this.name='firebase'}
  FirebaseBackend.prototype.init=function(){
    var self=this;
    return loadScript(BASE+'firebase-app-compat.js')
      .then(function(){return Promise.all([loadScript(BASE+'firebase-auth-compat.js'),loadScript(BASE+'firebase-database-compat.js')])})
      .then(function(){
        if(!firebase.apps.length)firebase.initializeApp(self.cfg);
        self.db=firebase.database();self.auth=firebase.auth();
      });
  };
  FirebaseBackend.prototype.onConnection=function(cb){this.db.ref('.info/connected').on('value',function(s){cb(!!s.val())})};
  FirebaseBackend.prototype.onAuth=function(cb){this.auth.onAuthStateChanged(function(u){cb(u?{email:u.email,uid:u.uid}:null)})};
  FirebaseBackend.prototype.signIn=function(e,p){return this.auth.signInWithEmailAndPassword(e,p)};
  FirebaseBackend.prototype.signOut=function(){return this.auth.signOut()};
  FirebaseBackend.prototype.watchRoom=function(code,h){
    var sref=this.db.ref('rooms/'+code+'/state'),rref=this.db.ref('rooms/'+code+'/resources');
    var f1=sref.on('value',function(s){h.onState&&h.onState(s.val())},function(e){h.onError&&h.onError(e)});
    var f2=rref.on('value',function(s){
      var v=s.val()||{},list=Object.keys(v).map(function(k){var o=v[k];o.id=k;return o}).sort(function(a,b){return (a.ts||0)-(b.ts||0)});
      h.onResources&&h.onResources(list);
    },function(e){h.onError&&h.onError(e)});
    return function(){sref.off('value',f1);rref.off('value',f2)};
  };
  FirebaseBackend.prototype.setState=function(code,patch){return this.db.ref('rooms/'+code+'/state').update(patch)};
  FirebaseBackend.prototype.addResource=function(code,item){return this.db.ref('rooms/'+code+'/resources').push(item)};
  FirebaseBackend.prototype.removeResource=function(code,id){return this.db.ref('rooms/'+code+'/resources/'+id).remove()};

  /* ---------- Mock (같은 브라우저의 탭끼리 연습) ---------- */
  function MockBackend(){this.name='mock';this.user=null;this.authCbs=[];this.bc=('BroadcastChannel' in window)?new BroadcastChannel('lec-mock'):null}
  MockBackend.prototype.init=function(){return Promise.resolve()};
  MockBackend.prototype.onConnection=function(cb){setTimeout(function(){cb(true)},0)};
  MockBackend.prototype.onAuth=function(cb){this.authCbs.push(cb);var u=this.user;setTimeout(function(){cb(u)},0)};
  MockBackend.prototype._auth=function(u){this.user=u;this.authCbs.forEach(function(c){c(u)})};
  MockBackend.prototype.signIn=function(e){this._auth({email:e||'연습',uid:'mock'});return Promise.resolve()};
  MockBackend.prototype.signOut=function(){this._auth(null);return Promise.resolve()};
  MockBackend.prototype._get=function(k){try{return JSON.parse(localStorage.getItem('mock:'+k)||'null')}catch(e){return null}};
  MockBackend.prototype._set=function(k,v){localStorage.setItem('mock:'+k,JSON.stringify(v));if(this.bc)this.bc.postMessage(k)};
  MockBackend.prototype.watchRoom=function(code,h){
    var self=this,ks='state:'+code,kr='res:'+code;
    function push(){h.onState&&h.onState(self._get(ks));h.onResources&&h.onResources(self._get(kr)||[])}
    function on(e){if(!e.data||e.data===ks||e.data===kr)push()}
    function onStore(e){if(e.key&&e.key.indexOf('mock:')===0)push()}
    if(this.bc)this.bc.addEventListener('message',on);window.addEventListener('storage',onStore);
    setTimeout(push,0);
    return function(){if(self.bc)self.bc.removeEventListener('message',on);window.removeEventListener('storage',onStore)};
  };
  MockBackend.prototype.setState=function(code,patch){
    if(!this.user)return Promise.reject(new Error('permission_denied'));
    var cur=this._get('state:'+code)||{};for(var k in patch)cur[k]=patch[k];this._set('state:'+code,cur);return Promise.resolve();
  };
  MockBackend.prototype.addResource=function(code,item){
    if(!this.user)return Promise.reject(new Error('permission_denied'));
    var l=this._get('res:'+code)||[];item.id='m'+Date.now();l.push(item);this._set('res:'+code,l);return Promise.resolve();
  };
  MockBackend.prototype.removeResource=function(code,id){
    if(!this.user)return Promise.reject(new Error('permission_denied'));
    var l=(this._get('res:'+code)||[]).filter(function(x){return x.id!==id});this._set('res:'+code,l);return Promise.resolve();
  };

  window.LectureSync={Firebase:FirebaseBackend,Mock:MockBackend,validCfg:validCfg};
})();
