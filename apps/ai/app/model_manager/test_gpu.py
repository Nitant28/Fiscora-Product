from app.model_manager.gpu import GPUManager


print("GPU:", GPUManager.available())

print("Device:", GPUManager.device())

print("Count:", GPUManager.count())

print("Name:", GPUManager.name())