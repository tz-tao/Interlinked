import { Contact } from "../types";

// This service handles the "Implicit Grant" flow for client-side apps.
// It requires a valid Client ID to be functional.

export const SCOPES = 'https://www.googleapis.com/auth/contacts.readonly';

export const parseGoogleContact = (gContact: any): Contact => {
  const resourceName = gContact.resourceName;
  const id = resourceName ? resourceName.replace('people/', '') : Math.random().toString(36).substr(2, 9);
  
  const name = gContact.names?.[0]?.displayName || gContact.names?.[0]?.givenName || 'Unknown';
  const email = gContact.emailAddresses?.[0]?.value || '';
  const phone = gContact.phoneNumbers?.[0]?.value || '';
  const company = gContact.organizations?.[0]?.name || '';
  const role = gContact.organizations?.[0]?.title || '';
  const location = gContact.addresses?.[0]?.formattedValue || '';
  
  // Extract secondary info to notes
  const biography = gContact.biographies?.[0]?.value || '';
  let notes = biography;
  
  // If there are multiple phones, put others in notes? 
  // For now just taking primary to field, keeping notes clean.

  return {
    id,
    name,
    email,
    phone,
    company,
    role,
    location,
    industry: '', // Google Contacts doesn't have a standard industry field
    lastContacted: new Date().toISOString(),
    tags: [],
    notes: notes,
    linkedIds: [],
    avatarUrl: gContact.photos?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
  };
};

// Robust CSV Parser (State Machine)
export const parseCSV = (csvText: string): Contact[] => {
  // Remove Byte Order Mark (BOM)
  const cleanText = csvText.replace(/^\uFEFF/, '');
  
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  // Iterate strictly by character to handle quoted newlines correctly
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i+1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote ("") inside a quoted field
        currentField += '"';
        i++; 
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
       // End of row
       if (char === '\r' && nextChar === '\n') {
         i++; // Skip \n if \r\n
       }
       currentRow.push(currentField);
       rows.push(currentRow);
       currentRow = [];
       currentField = '';
    } else {
      currentField += char;
    }
  }
  // Flush last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  // Parse headers (Normalize to lowercase)
  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  const contacts: Contact[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    
    // Skip empty rows
    if (values.length === 0 || (values.length === 1 && !values[0].trim())) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
        if (values[idx]) row[h] = values[idx].trim();
    });

    const get = (keys: string[]) => {
        for (const key of keys) {
            if (row[key]) return row[key];
        }
        return '';
    };

    // 1. Determine Name
    // Priority: Display Name -> First+Last -> Company -> Email -> Phone -> 'Unknown'
    let name = get(['name', 'display name']);
    // Extract Company from Name if in format "Name (Company)"
    let extractedCompanyFromName = '';
    const parenMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
    if (parenMatch) {
        name = parenMatch[1].trim();
        extractedCompanyFromName = parenMatch[2].trim();
    }

    if (!name) {
        const first = get(['first name', 'given name']);
        const mid = get(['middle name', 'additional name']);
        const last = get(['last name', 'family name']);
        const parts = [first, mid, last].filter(Boolean);
        if (parts.length > 0) name = parts.join(' ');
    }
    
    const orgName = get(['organization name', 'organization 1 - name', 'company']);
    const emailVal = get(['e-mail 1 - value', 'email address', 'email']);
    const phone1 = get(['phone 1 - value', 'mobile phone', 'phone']);

    if (!name) {
        if (orgName) name = orgName;
        else if (emailVal) name = emailVal;
        else if (phone1) name = phone1;
        else name = 'Unknown Contact';
    }

    const company = orgName || extractedCompanyFromName;
    const role = get(['organization title', 'organization 1 - title', 'job title', 'role']);
    
    // 2. Determine Location
    let location = get(['address 1 - formatted', 'business address', 'home address', 'location']);
    if (!location) {
        const city = get(['address 1 - city', 'city']);
        const country = get(['address 1 - country', 'country']);
        if (city || country) location = [city, country].filter(Boolean).join(', ');
    }

    // 3. Build Notes (Consolidate extra fields)
    let notes = get(['notes', 'description']);
    const appendToNotes = (label: string, val: string) => {
        if (val) {
            notes = notes ? `${notes}\n${label}: ${val}` : `${label}: ${val}`;
        }
    };

    // We mapped phone1 to the main phone field, so only append secondary phones to notes
    appendToNotes('Phone 2', get(['phone 2 - value']));
    appendToNotes('Birthday', get(['birthday']));
    appendToNotes('Website', get(['website 1 - value', 'website']));

    // 4. Parse Labels/Tags
    // Google Contacts exports labels like "Imported on 30/10 ::: * myContacts"
    const rawLabels = get(['labels', 'group membership']);
    const tags = rawLabels 
        ? rawLabels.split(' ::: ')
            .map(s => s.replace('* ', '').trim())
            .filter(s => s && !s.startsWith('Imported on') && s !== 'myContacts') // Filter out system tags
        : [];

    contacts.push({
        id: `csv-${Date.now()}-${i}`,
        name,
        email: emailVal,
        phone: phone1, // Primary phone
        company,
        role,
        location,
        industry: '', // Initial empty industry
        lastContacted: new Date().toISOString(),
        tags,
        notes,
        linkedIds: [],
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    });
  }
  return contacts;
};