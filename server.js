const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ប្រាប់ Server ឱ្យអានឯកសារ HTML ពីក្នុង Folder "public"
app.use(express.static(path.join(__dirname, "public")));

// -------------------------------------------------------------
// ១. តភ្ជាប់ទៅកាន់ MongoDB Atlas
// -------------------------------------------------------------
const MONGO_URI =
  "mongodb+srv://hadighany25_db_user:YNGQgEp2Pz6V8LWX@cluster0.izzf48u.mongodb.net/payhub_db?appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ ភ្ជាប់ទៅកាន់ MongoDB Atlas ជោគជ័យ!");
    checkSuperAdmin();
  })
  .catch((err) => {
    console.error("❌ បរាជ័យក្នុងការភ្ជាប់ Database:", err);
  });

// -------------------------------------------------------------
// ២. បង្កើត Schemas & Models
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
  created_at: { type: Date, default: Date.now },
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
  created_at: { type: Date, default: Date.now },
});
const Bill = mongoose.model("Bill", BillSchema);

const TransactionSchema = new mongoose.Schema({
  trx_id: String,
  bill_id: String,
  company: String,
  total_amount: Number,
  fee_amount: Number,
  net_amount: Number,
  date: { type: Date, default: Date.now },
});
const Transaction = mongoose.model("Transaction", TransactionSchema);

// បង្កើត Super Admin ស្វ័យប្រវត្តិ
const checkSuperAdmin = async () => {
  try {
    const admin = await User.findOne({ role: "superadmin" });
    if (!admin) {
      await User.create({
        email: "admin@gmail.com",
        password: "123",
        role: "superadmin",
        name: "PayHub HQ",
      });
      console.log("✅ បានបង្កើតគណនី Super Admin រួចរាល់!");
    }
  } catch (err) {
    console.error("❌ កំហុសក្នុងការបង្កើត Super Admin:", err);
  }
};

// -------------------------------------------------------------
// ៣. ROUTES & APIs ទូទៅ
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
      if (admin)
        return res.json({
          message: "ចូលប្រព័ន្ធ Super Admin ជោគជ័យ",
          user: admin,
        });
      return res
        .status(401)
        .json({ message: "អុីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ!" });
    }
    if (role === "company") {
      const user = await User.findOne({
        email,
        password,
        name: company,
        role: "company",
      });
      if (user) {
        if (user.status === "inactive")
          return res
            .status(403)
            .json({ message: "គណនីក្រុមហ៊ុនត្រូវបានផ្អាក!" });
        const { password: pwd, ...userData } = user.toObject();
        return res.json({ message: "ចូលប្រព័ន្ធជោគជ័យ", user: userData });
      }
      return res.status(401).json({ message: "ព័ត៌មានគណនីមិនត្រឹមត្រូវ!" });
    }
  } catch (err) {
    console.error(" Login Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- API គ្រប់គ្រងក្រុមហ៊ុន (ADMIN) ---
app.get("/api/companies", async (req, res) => {
  try {
    const companies = await User.find({ role: "company" }).select("name");
    res.json(companies.map((c) => c.name));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    res.json(await User.find());
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      category,
      upay_account,
      type,
      expiry_date,
      rate,
      fee_percent,
      password,
    } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { name }] });
    if (existingUser) {
      if (existingUser.email === email)
        return res.status(400).json({ message: "អ៊ីមែលនេះមានរួចហើយ!" });
      if (existingUser.name === name)
        return res.status(400).json({ message: "ក្រុមហ៊ុននេះមានរួចហើយ!" });
    }

    // ជួសជុលបញ្ហាការ Save ដោយប្រាកដថា rate និង fee_percent ជាលេខ (Number)
    const newUser = await User.create({
      id: `CO-${Date.now()}`,
      name,
      email,
      phone,
      category,
      upay_account,
      type,
      expiry_date,
      password,
      rate: Number(rate) || 0,
      fee_percent: Number(fee_percent) || 0,
      role: "company",
      status: "active",
      balance: 0,
    });
    console.log("✅ បានបង្កើតក្រុមហ៊ុនថ្មី:", name);
    res.status(201).json({ message: "បង្កើតបានជោគជ័យ!", user: newUser });
  } catch (err) {
    console.error("❌ Register Error:", err);
    res
      .status(500)
      .json({ message: "បរាជ័យក្នុងការ Save ទិន្នន័យ (Server Error)" });
  }
});

app.put("/api/admin/users/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.rate) updateData.rate = Number(updateData.rate);
    if (updateData.fee_percent)
      updateData.fee_percent = Number(updateData.fee_percent);

    const updated = await User.findOneAndUpdate(
      { id: req.params.id },
      updateData,
      { new: true },
    );
    if (!updated)
      return res.status(404).json({ message: "រកមិនឃើញក្រុមហ៊ុន!" });
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

// --- API គ្រប់គ្រងវិក្កយបត្រ (BILLS) ---
app.get("/api/bills", async (req, res) => {
  try {
    const company = req.query.company;
    let query = {};
    if (company && company !== "All") query.company = company;
    res.json(await Bill.find(query));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post("/api/bills", async (req, res) => {
  try {
    const newBill = await Bill.create({
      ...req.body,
      bill_id: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      status: "Unpaid",
    });
    res.status(201).json(newBill);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/bills/:bill_id", async (req, res) => {
  try {
    const updated = await Bill.findOneAndUpdate(
      { bill_id: req.params.bill_id },
      req.body,
    );
    if (!updated)
      return res.status(404).json({ message: "រកវិក្កយបត្រមិនឃើញ!" });
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
      { customer_name: req.body.customer_name },
    );
    res.json({ message: "កែប្រែជោគជ័យ" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// -------------------------------------------------------------
// ៤. GATEWAY (សម្រាប់ U-PAY ហៅចូលមក PayHub)
// -------------------------------------------------------------

// API នេះសម្រាប់ឱ្យ U-PAY App Scan QR Code រួចហៅមកសួររកវិក្កយបត្រ
app.get("/api/gateway/check-bill", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res
        .status(400)
        .json({ success: false, message: "សូមបញ្ចូលលេខវិក្កយបត្រ" });
    }

    // 🔥 បំប្លែង Query ទៅជា Regex ដើម្បីមិនប្រកាន់អក្សរតូចឬធំ (Case-insensitive) និងកាត់ចន្លោះចេញ
    const safeQuery = new RegExp(`^${query.trim()}$`, "i");

    // ស្វែងរកវិក្កយបត្រដែល Unpaid
    const bill = await Bill.findOne({
      $or: [{ bill_id: safeQuery }, { consumer_no: safeQuery }],
      status: new RegExp("^Unpaid$", "i"),
    });

    if (bill) {
      const company = await User.findOne({
        name: new RegExp(`^${bill.company}$`, "i"),
        role: "company",
      });

      if (company && company.status === "inactive") {
        return res.status(403).json({
          success: false,
          message: "ក្រុមហ៊ុននេះត្រូវបានផ្អាកសេវាកម្មទូទាត់បណ្តោះអាសន្ន!",
        });
      }

      // បោះទិន្នន័យពេញលេញទៅឱ្យ U-PAY App
      res.json({ success: true, bill });
    } else {
      res.status(404).json({
        success: false,
        message: "រកវិក្កយបត្រមិនឃើញ ឬវិក្កយបត្រនេះត្រូវបានទូទាត់រួចរាល់ហើយ!",
      });
    }
  } catch (err) {
    console.error("Gateway Check Bill Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error ក្នុងការស្វែងរក" });
  }
});

// API នេះសម្រាប់ឱ្យ U-PAY ហៅមកប្រាប់ PayHub ថាអតិថិជនទូទាត់រួចរាល់ហើយ (Webhook)
app.post("/api/gateway/pay", async (req, res) => {
  try {
    const { bill_id, upay_trx_id } = req.body;
    const bill = await Bill.findOne({ bill_id, status: "Unpaid" });

    if (!bill)
      return res
        .status(400)
        .json({ success: false, message: "វិក្កយបត្រត្រូវបានទូទាត់រួចហើយ" });

    // ១. កែប្រែស្ថានភាពវិក្កយបត្រទៅជា Paid
    bill.status = "Paid";
    bill.paid_at = new Date();
    await bill.save();

    // ២. ការទូទាត់ទាត់កាត់កង (Settlement) ចូលគណនីក្រុមហ៊ុន
    const company = await User.findOne({ name: bill.company, role: "company" });
    if (company) {
      const totalPaid = parseFloat(bill.total_amount_usd);
      const feePercent = company.fee_percent || 0;

      // គណនាលុយថ្លៃប្រើប្រាស់ដើម និងលុយថ្លៃសេវា ដែលបូកបញ្ចូលគ្នាក្នុង totalPaid
      const netAmt = totalPaid / (1 + feePercent / 100); // ប្រាក់ថ្លៃប្រើប្រាស់សុទ្ធដែលត្រូវប្រគល់ឱ្យក្រុមហ៊ុន
      const feeAmt = totalPaid - netAmt; // ប្រាក់សេវាដែល PayHub ត្រូវកាត់ទុក

      // បញ្ចូលលុយទៅក្នុង Balance របស់ក្រុមហ៊ុនក្នុងប្រព័ន្ធ
      company.balance = (company.balance || 0) + netAmt;
      await company.save();

      // ៣. កត់ត្រាចូលក្នុងតារាងប្រវត្តិ Transaction
      await Transaction.create({
        trx_id: upay_trx_id || `TRX-${Date.now()}`,
        bill_id: bill.bill_id,
        company: company.name,
        total_amount: bill.total_amount_usd,
        fee_amount: feeAmt,
        net_amount: netAmt,
      });
    }
    console.log(`✅ ការទូទាត់ជោគជ័យសម្រាប់វិក្កយបត្រ៖ ${bill_id}`);
    res.json({ success: true, message: "ទូទាត់ជោគជ័យ!" });
  } catch (err) {
    console.error("❌ Gateway Pay Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.listen(PORT, () => console.log(`✅ Server is running on port ${PORT}`));
