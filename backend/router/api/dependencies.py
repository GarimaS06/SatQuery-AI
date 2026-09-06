from ..orchestration.executor import Executor


def get_executor() -> Executor:
    from ..tools.build_registry import build_registry

    registry = build_registry()
    return Executor(registry)