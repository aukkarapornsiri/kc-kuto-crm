export function applyCompanyQuotationDefaults(template,company){
 if(!company)return template;
 const d=company.company_details||{};
 return {...template,company_logo_url:company.logo_url||'',company_name_th:company.company_name||template.company_name_th,company_name_en:company.company_name_en||template.company_name_en,company_address_th:d.address_th||template.company_address_th,company_address_en:d.address_en||template.company_address_en,company_tax_id:company.tax_id||template.company_tax_id,company_phone:d.sales_phone||company.phone||template.company_phone,company_email:d.sales_email||company.email||template.company_email,company_line:d.sales_line||d.line||template.company_line,sales_name:d.sales_name||'',sales_phone:d.sales_phone||'',sales_email:d.sales_email||'',sales_line:d.sales_line||''};
}
export const demoCompanyStore={value:null};
