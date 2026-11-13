import {
  connectDatabase,
  databaseErrorMessage,
  disconnectDatabase,
} from "../config/database.js";
import { resetPassword } from "../services/resetPassword.js";

const [email, ...extra] = process.argv.slice(2);
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
  extra.length
) {
  console.error("Indica um único email válido.");
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();
    const password = await resetPassword(email);
    if (!password) {
      console.error("Conta não encontrada.");
      process.exitCode = 1;
    } else {
      console.log(`Nova palavra-passe: ${password}`);
    }
  } catch (error) {
    console.error(databaseErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
