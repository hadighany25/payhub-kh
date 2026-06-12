const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------------------------------------------------
// ១. តភ្ជាប់ទៅកាន់ MongoDB Atlas
// -------------------------------------------------------------
const MONGO_URI = "mongodb+srv://hadighany25_db_user:cylhIkO9MRPkvZlq@cluster0.l4alwz4.mongodb.net/payhub_db?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ ភ្ជាប់ទៅកាន់ MongoDB Atlas ជោគជ័យ!");
    checkSuperAdmin(); // បង្កើត Super Admin ដោយស្វ័យប្រវត្តិបើមិនទាន់មាន
  }).catch(err => {
    console.error("❌ បរាជ័យក្នុងការភ្ជាប់ Database:", err);
  });

// -------------------------------------------------------------
// ២. បង្កើត Schemas & Models សម្រាប់ MongoDB
// -------------------------------------------------------------
const UserSchema = new mongoose.Schema({
  id: String,
  name: String,
  type: String,
  category: String,
  phone: String,
  upay_account: String,
  fee_percent: { type: Number, default: 0 },
  expiry_date: String,
  rate: Number,
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "company" },
  status: { type: String, default: "active" },
  balance: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
const User = mongoose.model("User", UserSchema);

const BillSchema = new mongoose.Schema({
  bill_id: String,
  company: String,
  customer_name: String,
  consumer_no: String,
  month: String,
  issue_date: String,
  due_date: String,
  old_reading: Number,
  new_reading: Number,
  usage_details: Number,
  rate: Number,
  total_amount_usd: Number,
  status: { type: String, default: "Unpaid" },
  paid_at: Date,
  created_at: { type: Date, default: Date.now }
});
const Bill = mongoose.model("Bill", BillSchema);

const TransactionSchema = new mongoose.Schema({
  trx_id: String,
  bill_id: String,
  company: String,
  total_amount: Number,
  fee_amount: Number,
  net_amount: Number,
  date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model("Transaction", TransactionSchema);

// បង្កើតគណនី Super Admin អូតូ
const checkSuperAdmin = async () => {
  const admin = await User.findOne({ role: "superadmin" });
  if (!admin) {
    await User.create({
      email: "admin@gmail.com",
      password: "123",
      role: "superadmin",
      name: "PayHub HQ"
    });
    console.log("✅ បានបង្កើតគណនី Super Admin រួចរាល់!");
  }
};

// -------------------------------------------------------------
// ៣. ROUTES & APIs ទាំងអស់
// -------------------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// --- LOGIN API ---
app.post("/api/login", async (req, res) => {
  try {
    const { role, email, password, company } = req.body;

    if (role === "superadmin") {
      const admin = await User.findOne({ email, password, role: "superadmin" });
      if (admin) return res.json({ message: "ចូលប្រព័ន្ធ Super Admin ជោគជ័យ", user: admin });
      return res.status(401).json({ message: "អុីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!" });
    }

    if (role === "company") {
      const user = await User.findOne({ email, password, name: company, role: "company" });
      if (user) {
        if (user.status === "inactive") {
          return res.status(403).json({ message: "គណនីក្រុមហ៊ុននេះត្រូវបានផ្អាកជាបណ្តោះអាសន្ន!" });
        }
        const { password: pwd, ...userData } = user.toObject();
        return res.json({ message: "ចូលប្រព័ន្ធជោគជ័យ", user: userData });
      }
      return res.status(401).json({ message: "ព័ត៌មានគណនីមិនត្រឹមត្រូវ!" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// --- ADMIN API (គ្រប់គ្រងក្រុមហ៊ុន) ---
app.get("/api/companies", async (req, res) => {
  try {
    const companies = await User.find({ role: "company" }).select("name");
    res.json(companies.map(c => c.name));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, ...otherData } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { name }] });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ message: "អ៊ីមែលនេះមានរួចហើយ!" });
      if (existingUser.name === name) return res.status(400).json({ message: "ក្រុមហ៊ុននេះមានរួចហើយ!" });
    }

    const newUser = await User.create({
      id: `CO-${Date.now()}`,
      name,
      email,
      ...otherData,
      role: "company",
      status: "active",
      balance: 0
    });
    res.status(201).json({ message: "បង្កើតបានជោគជ័យ!", user: newUser });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/admin/users/:id", async (req, res) => {
  try {
    const updatedUser = await User.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "រកមិនឃើញក្រុមហ៊ុនទេ!" });
    res.json({ message: "កែប្រែជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    await User.findOneAndDelete({ id: req.params.id });
    res.json({ message: "លុបជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// --- BILLS API ---
app.get("/api/bills", async (req, res) => {
  try {
    const company = req.query.company;
    let query = {};
    if (company && company !== "All") query.company = company;
    
    const bills = await Bill.find(query);
    res.json(bills);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post("/api/bills", async (req, res) => {
  try {
    const newBill = await Bill.create({
      ...req.body,
      bill_id: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      status: "Unpaid"
    });
    res.status(201).json(newBill);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/bills/:bill_id", async (req, res) => {
  try {
    const updated = await Bill.findOneAndUpdate({ bill_id: req.params.bill_id }, req.body);
    if (!updated) return res.status(404).json({ message: "រកវិក្កយបត្រមិនឃើញទេ!" });
    res.json({ message: "កែប្រែជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete("/api/bills/:bill_id", async (req, res) => {
  try {
    await Bill.findOneAndDelete({ bill_id: req.params.bill_id });
    res.json({ message: "លុបជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// --- CUSTOMERS API ---
app.delete("/api/customers/:consumer_no", async (req, res) => {
  try {
    await Bill.deleteMany({ consumer_no: req.params.consumer_no });
    res.json({ message: "លុបជោគជ័យ" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/customers/:consumer_no", async (req, res) => {
  try {
    await Bill.updateMany(
      { consumer_no: req.params.consumer_no },
      { customer_name: req.body.customer_name }
    );
    res.json({ message: "កែប្រែជោគជ័យ" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// --- GATEWAY & SETTLEMENT LOGIC ---
app.get("/api/gateway/check-bill", async (req, res) => {
  try {
    const { query } = req.query;
    const bill = await Bill.findOne({
      $or: [{ bill_id: query }, { consumer_no: query }],
      status: "Unpaid"
    });

    if (bill) {
      const company = await User.findOne({ name: bill.company, role: "company" });
      if (company && company.status === "inactive") {
        return res.status(403).json({ success: false, message: "ក្រុមហ៊ុននេះត្រូវបានផ្អាកសេវាកម្មទូទាត់!" });
      }
      res.json({ success: true, bill });
    } else {
      res.status(404).json({ success: false, message: "រកមិនឃើញ ឬទូទាត់រួចរាល់ហើយ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/gateway/pay", async (req, res) => {
  try {
    const { bill_id } = req.body;
    
    const bill = await Bill.findOne({ bill_id, status: "Unpaid" });
    if (!bill) return res.status(400).json({ success: false, message: "បរាជ័យក្នុងការទូទាត់ ឬបានទូទាត់រួចហើយ" });

    bill.status = "Paid";
    bill.paid_at = new Date();
    await bill.save();

    const company = await User.findOne({ name: bill.company, role: "company" });
    if (company) {
      const feePercent = company.fee_percent || 0;
      const totalAmt = parseFloat(bill.total_amount_usd);
      const feeAmt = (totalAmt * feePercent) / 100;
      const netAmt = totalAmt - feeAmt;

      company.balance = (company.balance || 0) + netAmt;
      await company.save();

      await Transaction.create({
        trx_id: `TRX-${Date.now()}`,
        bill_id: bill.bill_id,
        company: company.name,
        total_amount: totalAmt,
        fee_amount: feeAmt,
        net_amount: netAmt
      });
    }

    res.json({ success: true, message: "ទូទាត់វិក្កយបត្រជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.listen(PORT, () => console.log(`✅ Server is running on port ${PORT}`));