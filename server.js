const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "payhub_db.json");

const readDB = () => {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      // បន្ថែម Table "transactions" សម្រាប់ប្រវត្តិលំហូរប្រាក់
      const initialData = { users: [], bills: [], transactions: [] };
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (e) {
    return { users: [], bills: [], transactions: [] };
  }
};
const writeDB = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {}
};

const SUPER_ADMIN = {
  email: "admin@gmail.com",
  password: "123",
  role: "superadmin",
};

// 1. LOGIN LOGIC (ប្លុកគណនីដែល Inactive)
app.post("/api/login", (req, res) => {
  const { role, email, password, company } = req.body;
  const db = readDB();

  if (role === "superadmin") {
    if (email === SUPER_ADMIN.email && password === SUPER_ADMIN.password)
      return res.json({
        message: "ចូលប្រព័ន្ធ Super Admin ជោគជ័យ",
        user: SUPER_ADMIN,
      });
    return res
      .status(401)
      .json({ message: "អុីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!" });
  }
  if (role === "company") {
    const user = db.users.find(
      (u) => u.email === email && u.password === password && u.name === company,
    );
    if (user) {
      // [KILL SWITCH]: ឆែកបើ Admin បិទ (Inactive)
      if (user.status === "inactive")
        return res
          .status(403)
          .json({ message: "គណនីក្រុមហ៊ុននេះត្រូវបានផ្អាកជាបណ្តោះអាសន្ន!" });

      const { password, ...userData } = user;
      return res.json({ message: "ចូលប្រព័ន្ធជោគជ័យ", user: userData });
    }
    return res.status(401).json({ message: "ព័ត៌មានគណនីមិនត្រឹមត្រូវ!" });
  }
});

// 2. ADMIN API (បង្កើត និងកែប្រែក្រុមហ៊ុន)
// កែសម្រួល API នេះក្នុង server.js
app.get("/api/companies", (req, res) => {
  const db = readDB();
  // យកឈ្មោះក្រុមហ៊ុនទាំងអស់ មិនថា Active ឬ Inactive
  const companyNames = db.users
    .filter((u) => u.role === "company")
    .map((u) => u.name);
  res.json(companyNames);
});

app.get("/api/admin/users", (req, res) => {
  const db = readDB();
  res.json(db.users);
});

app.post("/api/register", (req, res) => {
  const db = readDB();
  const {
    name,
    type,
    category,
    phone,
    upay_account,
    fee_percent,
    expiry_date,
    rate,
    email,
    password,
  } = req.body;

  if (db.users.some((u) => u.email === email))
    return res.status(400).json({ message: "អ៊ីមែលនេះមានរួចហើយ!" });
  if (db.users.some((u) => u.name === name))
    return res.status(400).json({ message: "ក្រុមហ៊ុននេះមានរួចហើយ!" });

  const newUser = {
    id: `CO-${Date.now()}`,
    name,
    type,
    category,
    phone,
    upay_account,
    fee_percent: parseFloat(fee_percent) || 0,
    expiry_date,
    rate,
    email,
    password,
    role: "company",
    status: "active",
    balance: 0,
    created_at: new Date().toISOString(),
  };
  db.users.push(newUser);
  writeDB(db);
  res.status(201).json({ message: "បង្កើតបានជោគជ័យ!", user: newUser });
});

app.put("/api/admin/users/:id", (req, res) => {
  const db = readDB();
  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1)
    return res.status(404).json({ message: "រកមិនឃើញក្រុមហ៊ុនទេ!" });
  db.users[index] = { ...db.users[index], ...req.body };
  writeDB(db);
  res.json({ message: "កែប្រែជោគជ័យ!" });
});

app.delete("/api/admin/users/:id", (req, res) => {
  const db = readDB();
  db.users = db.users.filter((u) => u.id !== req.params.id);
  writeDB(db);
  res.json({ message: "លុបជោគជ័យ!" });
});

// 3. BILLS API
app.get("/api/bills", (req, res) => {
  const db = readDB();
  const company = req.query.company;
  if (company && company !== "All")
    return res.json(db.bills.filter((b) => b.company === company));
  res.json(db.bills);
});
app.post("/api/bills", (req, res) => {
  const db = readDB();
  const newBill = {
    ...req.body,
    bill_id: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
    status: "Unpaid",
    created_at: new Date().toISOString(),
  };
  db.bills.push(newBill);
  writeDB(db);
  res.status(201).json(newBill);
});
app.put("/api/bills/:bill_id", (req, res) => {
  const db = readDB();
  const index = db.bills.findIndex((b) => b.bill_id === req.params.bill_id);
  if (index === -1)
    return res.status(404).json({ message: "រកវិក្កយបត្រមិនឃើញទេ!" });
  db.bills[index] = { ...db.bills[index], ...req.body };
  writeDB(db);
  res.json({ message: "កែប្រែជោគជ័យ!" });
});
app.delete("/api/bills/:bill_id", (req, res) => {
  const db = readDB();
  db.bills = db.bills.filter((b) => b.bill_id !== req.params.bill_id);
  writeDB(db);
  res.json({ message: "លុបជោគជ័យ!" });
});

app.delete("/api/customers/:consumer_no", (req, res) => {
  const db = readDB();
  db.bills = db.bills.filter((b) => b.consumer_no !== req.params.consumer_no);
  writeDB(db);
  res.json({ message: "លុបជោគជ័យ" });
});
app.put("/api/customers/:consumer_no", (req, res) => {
  const db = readDB();
  db.bills = db.bills.map((b) =>
    b.consumer_no === req.params.consumer_no
      ? { ...b, customer_name: req.body.customer_name }
      : b,
  );
  writeDB(db);
  res.json({ message: "កែប្រែជោគជ័យ" });
});

// 4. GATEWAY & SETTLEMENT LOGIC (បាញ់លុយចូលគណនីក្រុមហ៊ុន)
app.get("/api/gateway/check-bill", (req, res) => {
  const { query } = req.query;
  const db = readDB();
  const bill = db.bills.find(
    (b) =>
      (b.bill_id === query || b.consumer_no === query) && b.status === "Unpaid",
  );

  if (bill) {
    // ឆែកមើលក្រែងលោក្រុមហ៊ុនត្រូវបិទ (Inactive)
    const company = db.users.find((u) => u.name === bill.company);
    if (company && company.status === "inactive")
      return res.status(403).json({
        success: false,
        message: "ក្រុមហ៊ុននេះត្រូវបានផ្អាកសេវាកម្មទូទាត់!",
      });
    res.json({ success: true, bill });
  } else
    res
      .status(404)
      .json({ success: false, message: "រកមិនឃើញ ឬទូទាត់រួចរាល់ហើយ!" });
});

app.post("/api/gateway/pay", (req, res) => {
  const { bill_id } = req.body;
  const db = readDB();

  const index = db.bills.findIndex(
    (b) => b.bill_id === bill_id && b.status === "Unpaid",
  );
  if (index !== -1) {
    const bill = db.bills[index];
    bill.status = "Paid";
    bill.paid_at = new Date().toISOString();

    // SETTLEMENT LOGIC: កាត់លុយ Fee និង បញ្ចូល Balance ក្រុមហ៊ុន
    const company = db.users.find((u) => u.name === bill.company);
    if (company) {
      const feePercent = company.fee_percent || 0;
      const totalAmt = parseFloat(bill.total_amount_usd);
      const feeAmt = (totalAmt * feePercent) / 100;
      const netAmt = totalAmt - feeAmt;

      company.balance = (parseFloat(company.balance) || 0) + netAmt; // Update Balance ជាក់ស្តែង

      // កត់ត្រាប្រវត្តិ Transaction
      if (!db.transactions) db.transactions = [];
      db.transactions.push({
        trx_id: `TRX-${Date.now()}`,
        bill_id: bill.bill_id,
        company: company.name,
        total_amount: totalAmt,
        fee_amount: feeAmt,
        net_amount: netAmt,
        date: new Date().toISOString(),
      });
    }

    writeDB(db);
    res.json({ success: true, message: "ទូទាត់វិក្កយបត្រជោគជ័យ!" });
  } else {
    res.status(400).json({ success: false, message: "បរាជ័យក្នុងការទូទាត់" });
  }
});

app.listen(PORT, () => console.log(`✅ Server is running on port ${PORT}`));
