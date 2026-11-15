// 심화 트랙: Firebase 로그인 / 회원가입 — 아이디 + 닉네임 + 비밀번호 (이메일 받지 않음)
// - 아이디는 Firebase에 '아이디@fridge-raid.app'으로 넘김 (진짜 메일 주소 아님, 메일도 안 감)
// - 가입하면 Firestore users/{uid} = { loginId, nickname }, nicknames/{닉네임} = { uid } (닉네임 중복 방지)
// - js/config.js의 FIREBASE_CONFIG가 비어 있으면 아무것도 불러오지 않고, app.js는 LocalStorage 로그인으로 동작
const V = '10.12.2';
const cfg = typeof FIREBASE_CONFIG === 'object' ? FIREBASE_CONFIG : {};

if (!cfg.apiKey) {
  console.info('[Firebase] js/config.js의 FIREBASE_CONFIG가 비어 있어 LocalStorage 로그인으로 동작해요');
} else {
  try {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    const app = initializeApp(cfg);
    const auth = A.getAuth(app), db = F.getFirestore(app);
    const key = n => n.toLowerCase();
    const mail = id => `${id}@fridge-raid.app`;
    const profile = async u => {
      const snap = await F.getDoc(F.doc(db, 'users', u.uid));
      return snap.exists() ? { uid: u.uid, loginId: snap.data().loginId, nickname: snap.data().nickname } : null;
    };

    window.fb = {
      // 회원가입: 닉네임 먼저 확인 → 계정 만들기 → 닉네임·회원 정보 저장 (저장 실패하면 만든 계정 지움)
      async signUp(loginId, nickname, pw) {
        const nickRef = F.doc(db, 'nicknames', key(nickname));
        if ((await F.getDoc(nickRef)).exists()) throw { code: 'nick-taken' };
        const { user } = await A.createUserWithEmailAndPassword(auth, mail(loginId), pw);
        try {
          await F.runTransaction(db, async t => {
            if ((await t.get(nickRef)).exists()) throw { code: 'nick-taken' };
            t.set(nickRef, { uid: user.uid });
            t.set(F.doc(db, 'users', user.uid), { loginId, nickname, createdAt: Date.now() });
          });
        } catch (e) { await user.delete().catch(() => {}); throw e; }
        console.log('[Firebase] 회원가입', loginId, nickname, user.uid);
        return { uid: user.uid, loginId, nickname };
      },
      // 로그인: 아이디·비밀번호 확인 → Firestore에서 닉네임 가져오기
      async signIn(loginId, pw) {
        const { user } = await A.signInWithEmailAndPassword(auth, mail(loginId), pw);
        const p = await profile(user);
        console.log('[Firebase] 로그인', loginId, user.uid);
        return p || { uid: user.uid, loginId, nickname: loginId };
      },
      signOut: () => A.signOut(auth),
      // 새로고침 후 로그인 상태 복원용
      async current() { return auth.currentUser ? profile(auth.currentUser) : null; },
    };
    A.onAuthStateChanged(auth, () => window.dispatchEvent(new Event('fb-ready')));
  } catch (e) {
    console.warn('[Firebase] 불러오기 실패 → LocalStorage 로그인으로 동작', e.message);
    window.fb = null;
  }
}
