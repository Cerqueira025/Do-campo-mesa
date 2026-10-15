import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function requireAuth(...roles) {
  return (request, response, next) => {
    const [scheme, token] = (request.get('authorization') || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return response.status(401).json({ erro: 'Autenticação necessária.' });
    }

    try {
      request.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return response.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    if (roles.length && !roles.includes(request.user.papel)) {
      return response.status(403).json({ erro: 'Sem permissão para esta operação.' });
    }
    next();
  };
}

export function requireApprovedProducer(request, response, next) {
  if (request.user.papel !== 'produtor') return response.status(403).json({ erro: 'Apenas produtores podem executar esta operação.' });
  User.findById(request.user.id).select('perfilProdutor.validacao')
    .then((producer) => {
      if (!producer || producer.perfilProdutor?.validacao !== 'aceite') {
        return response.status(403).json({ erro: 'O produtor precisa de aprovação.' });
      }
      next();
    }).catch(next);
}
