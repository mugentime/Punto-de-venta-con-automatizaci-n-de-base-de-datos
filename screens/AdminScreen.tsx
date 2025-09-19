import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TrashIcon } from '../components/Icons';

const AdminScreen: React.FC = () => {
  const { users, approveUser, deleteUser, currentUser } = useAppContext();

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  const statusBadge = (status: 'approved' | 'pending') => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Aprobado</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>;
      default:
        return null;
    }
  };

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6">Administrar Usuarios</h1>
      <div className="bg-white shadow-md rounded-3xl overflow-hidden">
        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-600">Usuario</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Email</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Rol</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Estado</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {otherUsers.map(user => (
                <tr key={user.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 text-sm text-slate-800 font-medium">{user.username}</td>
                  <td className="p-4 text-sm text-slate-500">{user.email}</td>
                  <td className="p-4 text-sm text-slate-500 capitalize">{user.role}</td>
                  <td className="p-4 text-sm">{statusBadge(user.status)}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center items-center space-x-2">
                      {user.status === 'pending' && (
                        <button
                          onClick={() => approveUser(user.id)}
                          className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600"
                        >
                          Aprobar
                        </button>
                      )}
                      <button 
                        onClick={() => deleteUser(user.id)} 
                        className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label={`Eliminar ${user.username}`}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
            {otherUsers.map(user => (
                <div key={user.id} className="border-b p-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-medium text-slate-800">{user.username}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        <div className="flex-shrink-0">{statusBadge(user.status)}</div>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                         <p className="text-sm text-slate-500 capitalize">Rol: {user.role}</p>
                         <div className="flex items-center space-x-2">
                            {user.status === 'pending' && (
                                <button onClick={() => approveUser(user.id)} className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600">
                                    Aprobar
                                </button>
                            )}
                            <button onClick={() => deleteUser(user.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors" aria-label={`Eliminar ${user.username}`}>
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {otherUsers.length === 0 && (
            <p className="text-center text-slate-500 py-8">No hay otros usuarios registrados.</p>
        )}
      </div>
    </div>
  );
};

export default AdminScreen;
