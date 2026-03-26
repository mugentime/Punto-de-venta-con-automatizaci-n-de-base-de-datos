const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

async function sendEmail() {
  console.log('📧 Preparando envío de correo electrónico...\n');

  // Verificar que los archivos existan
  const docsDir = path.join(__dirname, '..', 'docs');
  const mdFile = path.join(docsDir, 'reporte-completo-punto-venta.md');
  const jsonFile = path.join(docsDir, 'datos-completos-punto-venta.json');

  if (!fs.existsSync(mdFile) || !fs.existsSync(jsonFile)) {
    console.error('❌ Los archivos de reporte no existen');
    return;
  }

  console.log('✅ Archivos verificados\n');

  // Configurar transporter (usando Gmail como ejemplo)
  // IMPORTANTE: Necesitas habilitar "Aplicaciones menos seguras" en Gmail
  // O usar una contraseña de aplicación específica
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'tu-correo@gmail.com', // Reemplazar con tu correo
      pass: 'tu-contraseña-de-aplicación' // Contraseña de aplicación de Gmail
    }
  });

  const mailOptions = {
    from: 'tu-correo@gmail.com',
    to: 'je2alvarela@gmail.com',
    subject: 'Reporte Completo Punto de Venta - Conejo Negro',
    html: `
      <h2>Reporte Completo del Punto de Venta</h2>
      <p>Adjunto encontrarás el reporte completo con todos los datos extraídos de la base de datos:</p>
      <ul>
        <li><strong>Total registros:</strong> 1,698</li>
        <li><strong>Órdenes:</strong> 831</li>
        <li><strong>Ventas totales:</strong> $103,972.67</li>
        <li><strong>Ganancias:</strong> $107,702.00</li>
      </ul>
      <p><strong>Archivos adjuntos:</strong></p>
      <ol>
        <li>reporte-completo-punto-venta.md - Reporte detallado en formato Markdown</li>
        <li>datos-completos-punto-venta.json - Todos los datos en formato JSON</li>
      </ol>
      <p>Generado automáticamente por el sistema de extracción de datos.</p>
    `,
    attachments: [
      {
        filename: 'reporte-completo-punto-venta.md',
        path: mdFile
      },
      {
        filename: 'datos-completos-punto-venta.json',
        path: jsonFile
      }
    ]
  };

  try {
    console.log('📤 Enviando correo electrónico...\n');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado exitosamente!');
    console.log('📬 ID del mensaje:', info.messageId);
    console.log('📧 Destinatario:', 'je2alvarela@gmail.com');
  } catch (error) {
    console.error('❌ Error al enviar el correo:', error.message);
    console.log('\n⚠️  NOTA: Para enviar correos necesitas:');
    console.log('   1. Instalar nodemailer: npm install nodemailer');
    console.log('   2. Configurar credenciales de correo en el script');
    console.log('   3. Para Gmail: Habilitar "Contraseñas de aplicación" en tu cuenta Google');
  }
}

sendEmail();
