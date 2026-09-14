from functools import wraps
from threading import RLock

# The MVP has one in-process action worker. Archive and deletion share its lock.
board_action_lock = RLock()


def serialized_board_action(operation):
    @wraps(operation)
    def serialized(*args, **kwargs):
        with board_action_lock:
            return operation(*args, **kwargs)
    return serialized
