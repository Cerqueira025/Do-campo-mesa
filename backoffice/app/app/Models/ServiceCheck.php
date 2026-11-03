<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceCheck extends Model
{
    use HasFactory;

    public const SERVICES = ['api' => 'API', 'mongodb' => 'MongoDB', 'socketio' => 'Socket.io', 'swagger' => 'Swagger UI', 'storage' => 'Armazenamento'];

    public const STATUSES = ['ok' => 'Operacional', 'failure' => 'Falha', 'unknown' => 'Não foi possível verificar', 'not_implemented' => 'Não implementado'];

    public $timestamps = false;

    protected $fillable = ['run_id', 'service', 'status', 'message', 'duration_ms', 'checked_at'];

    protected function casts(): array
    {
        return ['checked_at' => 'immutable_datetime', 'duration_ms' => 'integer'];
    }
}
