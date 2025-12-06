import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export async function register(req, res) {
    const { email, password } = req.body;
    const user = new User({ email, password });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'changeme', { expiresIn: '1d' });
    res.json({ token });
}

export async function login(req, res) {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'changeme', { expiresIn: '1d' });
    res.json({ token });
}

export async function profile(req, res) {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
}
