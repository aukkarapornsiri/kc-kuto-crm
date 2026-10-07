// Login presentation only. The existing form's values, refs, callbacks and
// authentication client remain owned by the application, not by this layout.
export const GUEST_PORTAL_URL = 'https://kc-digital-workplace.kaicomhub.com/guest';

function icon(React, kind, extra = {}) {
  const h = React.createElement;
  const paths = {
    lock: 'M6 10h12v11H6ZM9 10V6a3 3 0 0 1 6 0v4M12 14v3',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
    shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM8 12l3 3 5-6',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z',
    eyeOff: 'm3 3 18 18M10.6 5.1A11.8 11.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 3.9M6.3 6.3A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.7-1.7'
  };
  return h('svg', {viewBox:'0 0 24 24', width:22, height:22, fill:'none', stroke:'currentColor', strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true, ...extra},
    h('path', {d:paths[kind] || paths.shield}),
    kind === 'people' && h('circle', {cx:9, cy:7, r:4}),
    kind === 'eye' && h('circle', {cx:12, cy:12, r:3})
  );
}

function PasswordField({React, lang, input}) {
  const h = React.createElement;
  const [visible, setVisible] = React.useState(false);
  const th = lang === 'th';
  return h('div', {className:'kc-login-password-field'},
    React.cloneElement(input, {type:visible ? 'text' : 'password', placeholder:th ? 'กรอกรหัสผ่าน' : 'Enter your password'}),
    h('button', {type:'button', className:'kc-login-password-toggle', disabled:input.props.disabled,
      'aria-label':visible ? (th ? 'ซ่อนรหัสผ่าน' : 'Hide password') : (th ? 'แสดงรหัสผ่าน' : 'Show password'),
      'aria-controls':'login-password', 'aria-pressed':visible, onClick:()=>setVisible(v=>!v)}, icon(React, visible ? 'eyeOff' : 'eye'))
  );
}

export function LoginLayout({React, lang, onLanguage, logo, children}) {
  const h = React.createElement;
  const t = (th, en) => lang === 'th' ? th : en;
  // Preserve the pre-existing isolated demo for explicit QA/demo links only.
  // The Guest Portal never calls enterDemoMode or changes CRM authentication.
  const showDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  function present(node) {
    if (!React.isValidElement(node)) return node;
    if (node.props.id === 'login-password') return h(PasswordField, {React, lang, input:node, key:'password-field'});
    if (node.props.className === 'kc-login-demo') return h('div', {className:'kc-login-secondary', key:'guest-access'},
      h('p', {className:'kc-login-help'}, t('ลืมรหัสผ่าน? ติดต่อผู้ดูแลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่', 'Forgot your password? Contact your administrator for a password reset link.')),
      h('a', {className:'kc-login-guest', href:GUEST_PORTAL_URL, referrerPolicy:'no-referrer'}, icon(React, 'people'),
        h('span', null, t('Guest Portal · สำหรับบุคคลภายนอก', 'Guest Portal · For external users'))),
      showDemo ? node : null
    );
    return node.props.children == null ? node : React.cloneElement(node, undefined, React.Children.map(node.props.children, present));
  }
  return h('main', {className:'kc-login'},
    h('div', {className:'kc-login-shell'},
      h('section', {className:'kc-login-brand', 'aria-label':t('เกี่ยวกับ KC CuTo CRM','About KC CuTo CRM')},
        // Trim only the known transparent inset of the supplied 1500x500 logo.
        // Original artwork is untouched; its visible left edge aligns with text.
        h('div', {className:'kc-login-logo'}, h('svg', {viewBox:'135 76 1265 383', role:'img', 'aria-label':'KC CuTo CRM', preserveAspectRatio:'xMinYMid meet'}, h('image', {href:logo, width:1500, height:500}))),
        h('div', {className:'kc-login-story'},
          h('span', {className:'kc-login-badge'}, icon(React,'shield'), t('แพลตฟอร์มบริหารลูกค้าและงานขายสำหรับองค์กร','Customer and sales management for your business')),
          h('h1', null, t('ทุกความสัมพันธ์ ทุกโอกาส','Every relationship. Every opportunity.'), h('br'), t('เติบโตไปด้วยกัน','Grow together.')),
          h('p', null, t('เชื่อมโยงลีด ลูกค้า และผู้ติดต่อ พร้อมติดตามโอกาสการขาย ใบเสนอราคา และงานบริการในระบบเดียว','Connect leads, customers and contacts. Manage opportunities, quotations and service in one workspace.')),
          h('div', {className:'kc-login-features'}, [
            ['lock','ข้อมูลลูกค้าในที่เดียว','Customer information'],
            ['people','ทำงานร่วมกันเป็นทีม','Team collaboration'],
            ['shield','เข้าถึงตามสิทธิ์ผู้ใช้','Role-based access']
          ].map(([kind,th,en])=>h('div', {key:kind}, icon(React,kind), h('span',null,t(th,en)))))
        ),
        h('footer', null, h('span',null,'© '+new Date().getFullYear()+' KAI-COM'), h('span',null,t('สำหรับผู้ได้รับอนุญาตเท่านั้น','For authorized users only')))
      ),
      h('section', {className:'kc-login-access', 'aria-label':t('เข้าสู่ระบบ','Sign in')},
        h('header', {className:'kc-login-top'}, h('span',null,t('KC Digital Workplace · พื้นที่ทำงานดิจิทัล','KC Digital Workplace · Digital workspace')),
          h('button', {type:'button', className:'kc-login-language', onClick:onLanguage, 'aria-label':t('เปลี่ยนเป็นภาษาอังกฤษ','Switch to Thai')}, h('span',{'aria-hidden':true},'◎'), lang === 'th' ? 'TH' : 'EN')),
        h('div', {className:'kc-login-content'},
          h('h2',null,t('ยินดีต้อนรับกลับ','Welcome back')),
          h('p',{className:'kc-login-intro'},t('เข้าสู่ระบบเพื่อเปิดพื้นที่ทำงานของคุณ','Sign in to your workspace')),
          present(children),
          h('div',{className:'kc-login-assurance'},icon(React,'shield'),h('div',null,
            h('strong',null,t('พื้นที่ทำงานสำหรับทีมของคุณ','Your team’s workspace')),
            h('p',null,t('เข้าถึงข้อมูลและเมนูตามบทบาทและสิทธิ์ที่ได้รับ','Access data and menus according to your assigned role and permissions')))),
          h('p',{className:'kc-login-session-note'},icon(React,'lock'),h('span',null,t('ระบบจดจำการเข้าสู่ระบบบนเบราว์เซอร์นี้ กรุณาออกจากระบบเมื่อใช้เครื่องร่วมกับผู้อื่น','This browser remembers your sign-in. Please sign out when using a shared computer.')))
        ),
        h('footer',null,t('KC Digital Workplace · สำหรับผู้ได้รับอนุญาตเท่านั้น','KC Digital Workplace · For authorized users only'))
      )
    )
  );
}
