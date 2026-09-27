const railFor={
  Dashboard:'Home',Leads:'Leads',Contacts:'Contacts',Customers:'Accounts',
  Opportunities:'Sales',Quotations:'Sales','Contracts & Renewal':'Sales',
  'Assets / Installed Base':'Service','Tickets / Service Desk':'Service',
  Activities:'Activities',Documents:'Documents',
  'Reports & Analytics':'Analytics','AI Insights':'Analytics',Settings:'Settings',
};
const grouped=new Set(['Sales','Service','Analytics']);

export async function openDesktopMenu(page,parent,child){
  const rail=page.getByRole('navigation',{name:'Primary navigation'});
  const section=page.getByRole('navigation',{name:'Section navigation'});
  const category=railFor[parent];
  if(!category)throw new Error(`Unknown module: ${parent}`);
  await rail.getByRole('button',{name:category,exact:true}).click();
  if(grouped.has(category)){
    if(child){
      await section.getByRole('button',{name:`Pages in ${parent}`,exact:true}).click();
      await section.getByRole('menuitem',{name:child,exact:true}).click();
    }else await section.getByRole('button',{name:parent,exact:true}).click();
  }else if(child){
    const tab=section.getByRole('button',{name:child,exact:true});
    if(await tab.count())await tab.click();
    else{
      await section.getByRole('button',{name:/^More/}).click();
      await section.getByRole('menuitem',{name:child,exact:true}).click();
    }
  }
}

export const railLabels=['Home','Leads','Contacts','Accounts','Sales','Service','Activities','Documents','Analytics','Settings'];

export async function openThaiSettings(page,width){
  if(width>=1024)return page.getByRole('navigation',{name:'หมวดหลัก'}).getByRole('button',{name:'ตั้งค่า',exact:true}).click();
  await page.locator('button.lg\\:hidden').first().click();
  await page.getByRole('button',{name:'ตั้งค่าระบบ',exact:true}).filter({visible:true}).click();
}
